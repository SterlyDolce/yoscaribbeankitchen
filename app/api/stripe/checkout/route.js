import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { getMenuItem } from "../../../menu-data";
import { formatDeliveryAddress, normalizeGuestContact, validateCustomer } from "../../../order/guest-checkout";
import { buildOrderLines, buildRequestedItems, calculateOrderTotals } from "../../../order/order-pricing";
import { getUserForSessionToken, sessionCookieName } from "../../../session";

const fulfillmentMethods = new Set(["Pickup", "Delivery"]);

function getBaseUrl(request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.STRIPE_SUCCESS_BASE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin;

  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

async function stripeRequest(endpoint, payload) {
  const response = await fetch(`https://api.stripe.com${endpoint}`, {
    body: new URLSearchParams(payload),
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || "Unable to start Stripe checkout.");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ message: "Stripe is not configured." }, { status: 503 });
  }

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);
  const body = await request.json();
  const fulfillmentMethod = body.fulfillmentMethod;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!fulfillmentMethods.has(fulfillmentMethod)) {
    return NextResponse.json({ message: "Choose pickup or delivery." }, { status: 400 });
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

  const requestedItems = buildRequestedItems(items);

  if (requestedItems.length === 0) {
    return NextResponse.json({ message: "Add at least one item before checking out." }, { status: 400 });
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
  const totals = calculateOrderTotals(orderLines, fulfillmentMethod);

  try {
    const orderResult = await query(
      `insert into public.orders
        (user_id, guest_name, guest_email, guest_phone, fulfillment_method, payment_preference, delivery_address, subtotal, tax, total)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        user?.id || null,
        customerResult.guestContact?.fullName || null,
        customerResult.guestContact?.email || null,
        customerResult.guestContact?.phone || null,
        fulfillmentMethod,
        "Pay online",
        deliveryAddress,
        totals.subtotal,
        totals.tax,
        totals.total
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

    const baseUrl = getBaseUrl(request);
    const successPath = user
      ? `/account?order=${order.id}&payment=success`
      : `/confirm-order?order=${order.id}&payment=success`;
    const payload = {
      "automatic_tax[enabled]": "false",
      "customer_email": customer.email,
      "metadata[order_id]": order.id,
      mode: "payment",
      success_url: `${baseUrl}${successPath}`,
      cancel_url: `${baseUrl}/confirm-order?payment=cancelled`
    };

    orderLines.forEach((line, index) => {
      payload[`line_items[${index}][quantity]`] = String(line.quantity);
      payload[`line_items[${index}][price_data][currency]`] = "usd";
      payload[`line_items[${index}][price_data][unit_amount]`] = String(toCents(line.unitPrice));
      payload[`line_items[${index}][price_data][product_data][name]`] = line.menuItem.name;
      if (line.instructions) {
        payload[`line_items[${index}][price_data][product_data][description]`] = line.instructions;
      }
    });

    let feeIndex = orderLines.length;

    for (const fee of [
      ["Service fee", totals.serviceFee],
      ["Delivery fee", totals.deliveryFee],
      ["Estimated tax", totals.tax]
    ]) {
      const [name, amount] = fee;
      if (amount <= 0) continue;

      payload[`line_items[${feeIndex}][quantity]`] = "1";
      payload[`line_items[${feeIndex}][price_data][currency]`] = "usd";
      payload[`line_items[${feeIndex}][price_data][unit_amount]`] = String(toCents(amount));
      payload[`line_items[${feeIndex}][price_data][product_data][name]`] = name;
      feeIndex += 1;
    }

    const session = await stripeRequest("/v1/checkout/sessions", payload);

    return NextResponse.json({ orderId: order.id, url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe checkout session.", error);
    return NextResponse.json({ message: error.message || "Unable to start checkout." }, { status: 500 });
  }
}
