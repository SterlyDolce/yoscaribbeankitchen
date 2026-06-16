import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../db";
import { getMenuItem } from "../../menu-data";
import { formatMenuItemSelections, validateMenuItemSelections } from "../../menu-customizations";
import { getUserForSessionToken, sessionCookieName } from "../../session";

const taxRate = 0.07;
const fulfillmentMethods = new Set(["Pickup", "Delivery"]);
const paymentPreferences = new Set(["Pay in person", "Pay online"]);

function money(value) {
  return Math.round(value * 100) / 100;
}

function formatDeliveryAddress(user) {
  if (!user.addressLine1 || !user.city || !user.state || !user.postalCode) {
    return null;
  }

  return [
    user.addressLine1,
    user.addressLine2,
    `${user.city}, ${user.state} ${user.postalCode}`,
    user.deliveryNotes ? `Notes: ${user.deliveryNotes}` : null
  ].filter(Boolean).join("\n");
}

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (!user) {
    return NextResponse.json({ message: "Sign in to place an order." }, { status: 401 });
  }

  const body = await request.json();
  const fulfillmentMethod = body.fulfillmentMethod;
  const paymentPreference = body.paymentPreference;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!fulfillmentMethods.has(fulfillmentMethod) || !paymentPreferences.has(paymentPreference)) {
    return NextResponse.json({ message: "Choose a valid order and payment option." }, { status: 400 });
  }

  const deliveryAddress = fulfillmentMethod === "Delivery" ? formatDeliveryAddress(user) : null;

  if (fulfillmentMethod === "Delivery" && !deliveryAddress) {
    return NextResponse.json(
      { message: "Add a delivery address to your account before placing a delivery order." },
      { status: 400 }
    );
  }

  const requestedItems = items
    .map((item) => ({
      instructions: String(item.instructions || "").trim().slice(0, 300),
      quantity: Number.parseInt(item.quantity, 10),
      selections: item.selections && typeof item.selections === "object" ? item.selections : {},
      slug: String(item.slug || "")
    }))
    .filter((item) => item.slug && Number.isInteger(item.quantity) && item.quantity > 0);

  if (requestedItems.length === 0) {
    return NextResponse.json({ message: "Add at least one item before placing an order." }, { status: 400 });
  }

  const menuBySlug = new Map();

  for (const requestedItem of requestedItems) {
    const menuItem = await getMenuItem(requestedItem.slug);

    if (menuItem) {
      menuBySlug.set(menuItem.slug, menuItem);
    }
  }

  if (menuBySlug.size !== new Set(requestedItems.map((item) => item.slug)).size) {
    return NextResponse.json({ message: "One or more menu items are no longer available." }, { status: 400 });
  }

  const orderLines = [];

  for (const requestedItem of requestedItems) {
    const menuItem = menuBySlug.get(requestedItem.slug);
    const selectionResult = validateMenuItemSelections(menuItem, requestedItem.selections);

    if (!selectionResult.valid) {
      return NextResponse.json({ message: selectionResult.message }, { status: 400 });
    }

    const unitPrice = Number(menuItem.price) + selectionResult.priceAdjustment;
    const lineTotal = money(unitPrice * requestedItem.quantity);
    const mealSelections = formatMenuItemSelections(menuItem, selectionResult.selections);
    const instructions = [mealSelections, requestedItem.instructions]
      .filter(Boolean)
      .join("; ")
      .slice(0, 600);

    orderLines.push({
      instructions,
      lineTotal,
      menuItem,
      quantity: requestedItem.quantity,
      unitPrice
    });
  }
  const subtotal = money(orderLines.reduce((total, line) => total + line.lineTotal, 0));
  const tax = money(subtotal * taxRate);
  const total = money(subtotal + tax);

  try {
    const orderResult = await query(
      `insert into public.orders (user_id, fulfillment_method, payment_preference, delivery_address, subtotal, tax, total)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, status, total, created_at`,
      [user.id, fulfillmentMethod, paymentPreference, deliveryAddress, subtotal, tax, total]
    );
    const order = orderResult.rows[0];

    for (const line of orderLines) {
      await query(
        `insert into public.order_items
          (order_id, menu_item_id, menu_item_slug, item_name, special_instructions, quantity, unit_price, line_total)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          line.menuItem.id,
          line.menuItem.slug,
          line.menuItem.name,
          line.instructions || null,
          line.quantity,
          line.unitPrice,
          line.lineTotal
        ]
      );
    }

    return NextResponse.json({
      order: {
        createdAt: order.created_at,
        id: order.id,
        status: order.status,
        total: Number(order.total)
      }
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to place order.", error);

    return NextResponse.json({ message: "Unable to place order right now." }, { status: 500 });
  }
}
