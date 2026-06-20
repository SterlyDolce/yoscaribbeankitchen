import { NextResponse } from "next/server";
import { ensureAccountBalanceSchema } from "../../account-balance-schema";
import { hasDatabaseConfig, query } from "../../db";
import { getMenuItem } from "../../menu-data";
import { formatDeliveryAddress, normalizeGuestContact, validateCustomer } from "../../order/guest-checkout";
import { ensureOrderPaymentTracking } from "../../order/payment-schema";
import { buildOrderLines, buildRequestedItems, calculateOrderTotals, money } from "../../order/order-pricing";
import { getServiceAreaError } from "../../order/service-area";
import { getUserForSessionToken, sessionCookieName } from "../../session";
import { notifyStaffForOrderStatus } from "../../staff-notifications";

const fulfillmentMethods = new Set(["Delivery"]);
const paymentPreferences = new Set(["Pay in person", "Pay online"]);

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  await ensureOrderPaymentTracking();
  await ensureAccountBalanceSchema();

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);
  const body = await request.json();
  const fulfillmentMethod = body.fulfillmentMethod;
  const paymentPreference = body.paymentPreference;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!fulfillmentMethods.has(fulfillmentMethod) || !paymentPreferences.has(paymentPreference)) {
    return NextResponse.json({ message: "Delivery is the only available order option right now." }, { status: 400 });
  }

  const guestContact = normalizeGuestContact(body.guestContact);
  const customerResult = validateCustomer(user, guestContact, fulfillmentMethod);

  if (!customerResult.valid) {
    return NextResponse.json({ message: customerResult.message }, { status: 400 });
  }

  const customer = customerResult.customer;
  const deliveryAddress = fulfillmentMethod === "Delivery" ? formatDeliveryAddress(customer) : null;

  if (fulfillmentMethod === "Delivery" && !deliveryAddress) {
    return NextResponse.json(
      { message: "Add a delivery address to your account before placing a delivery order." },
      { status: 400 }
    );
  }

  if (fulfillmentMethod === "Delivery") {
    const serviceAreaError = getServiceAreaError(customer);

    if (serviceAreaError) {
      return NextResponse.json({ message: serviceAreaError }, { status: 400 });
    }
  }

  const requestedItems = buildRequestedItems(items);

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

  const orderLinesResult = buildOrderLines(requestedItems, menuBySlug);

  if (!orderLinesResult.valid) {
    return NextResponse.json({ message: orderLinesResult.message }, { status: 400 });
  }

  const orderLines = orderLinesResult.orderLines;
  const { subtotal, tax, total } = calculateOrderTotals(orderLines, fulfillmentMethod);
  const accountBalanceApplied = user ? money(Number(user.accountBalance || 0)) : 0;
  const orderTotal = money(total + accountBalanceApplied);

  try {
    const orderResult = await query(
      `insert into public.orders
        (user_id, guest_name, guest_email, guest_phone, fulfillment_method, payment_preference, payment_status, delivery_address, subtotal, tax, account_balance_applied, total)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id, status, total, created_at`,
      [
        user?.id || null,
        customerResult.guestContact?.fullName || null,
        customerResult.guestContact?.email || null,
        customerResult.guestContact?.phone || null,
        fulfillmentMethod,
        paymentPreference,
        paymentPreference === "Pay online" ? "pending" : "pay_in_person",
        deliveryAddress,
        subtotal,
        tax,
        accountBalanceApplied,
        orderTotal
      ]
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

    if (order.status === "requested") {
      await notifyStaffForOrderStatus(
        order.id,
        order.status,
        "New Yo's order",
        `${customer.fullName} placed a ${fulfillmentMethod.toLowerCase()} order.`
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
