import { NextResponse } from "next/server";
import { ensureAccountBalanceSchema } from "../../../account-balance-schema";
import { hasDatabaseConfig, query } from "../../../db";
import { getMenuItem } from "../../../menu-data";
import { formatDeliveryAddress, normalizeGuestContact, validateCustomer } from "../../../order/guest-checkout";
import { ensureOrderPaymentTracking } from "../../../order/payment-schema";
import { normalizeReadyTime } from "../../../order/ready-time";
import { buildOrderLines, buildRequestedItems, calculateOrderTotals, money } from "../../../order/order-pricing";
import { getServiceAreaError } from "../../../order/service-area";
import { getUserForSessionToken, sessionCookieName } from "../../../session";

const fulfillmentMethods = new Set(["Delivery"]);

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

  await ensureOrderPaymentTracking();
  await ensureAccountBalanceSchema();

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);
  const body = await request.json();
  const fulfillmentMethod = body.fulfillmentMethod;
  const readyTime = normalizeReadyTime(body.readyTime, body.deliveryTime);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!fulfillmentMethods.has(fulfillmentMethod)) {
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
  const accountBalanceApplied = user ? money(Number(user.accountBalance || 0)) : 0;
  const orderTotal = money(totals.total + accountBalanceApplied);
  let pendingOrderId = null;

  try {
    const orderResult = await query(
      `insert into public.orders
        (user_id, guest_name, guest_email, guest_phone, fulfillment_method, payment_preference, payment_status, delivery_address, ready_time, status, subtotal, tax, account_balance_applied, total)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning id`,
      [
        user?.id || null,
        customerResult.guestContact?.fullName || null,
        customerResult.guestContact?.email || null,
        customerResult.guestContact?.phone || null,
        fulfillmentMethod,
        "Pay online",
        "pending",
        deliveryAddress,
        readyTime,
        "payment_pending",
        totals.subtotal,
        totals.tax,
        accountBalanceApplied,
        orderTotal
      ]
    );
    const order = orderResult.rows[0];
    pendingOrderId = order.id;

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
    const payload = {
      "automatic_tax[enabled]": "false",
      "customer_email": customer.email,
      "metadata[order_id]": order.id,
      mode: "payment",
      success_url: `${baseUrl}/order-success?order=${order.id}`,
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
      ["Estimated tax", totals.tax],
      ["Account back balance", accountBalanceApplied]
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

    await query(
      `update public.orders
       set stripe_session_id = $1,
           stripe_payment_intent_id = $2
       where id = $3`,
      [session.id, session.payment_intent || null, order.id]
    );

    return NextResponse.json({ orderId: order.id, url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe checkout session.", error);
    if (pendingOrderId) {
      await query(
        `update public.orders
         set status = 'cancelled',
             payment_status = 'checkout_failed'
         where id = $1`,
        [pendingOrderId]
      );
    }
    return NextResponse.json({ message: error.message || "Unable to start checkout." }, { status: 500 });
  }
}
