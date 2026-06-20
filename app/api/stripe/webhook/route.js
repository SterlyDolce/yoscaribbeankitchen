import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ensureAccountBalanceSchema } from "../../../account-balance-schema";
import { hasDatabaseConfig, query } from "../../../db";
import { ensureOrderPaymentTracking } from "../../../order/payment-schema";
import { notifyStaffForOrderStatus } from "../../../staff-notifications";

function parseStripeSignature(header) {
  return String(header || "")
    .split(",")
    .reduce((parts, item) => {
      const [key, value] = item.split("=");
      if (key && value) parts[key] = value;
      return parts;
    }, {});
}

function verifyStripeSignature(payload, signatureHeader) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Stripe webhook secret is not configured.");
  }

  const signature = parseStripeSignature(signatureHeader);
  const timestamp = signature.t;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const receivedSignature = signature.v1;

  if (!timestamp || !receivedSignature) {
    throw new Error("Missing Stripe signature.");
  }

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const receivedBuffer = Buffer.from(receivedSignature, "hex");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error("Invalid Stripe signature.");
  }
}

async function updateOrderFromCheckoutSession(session, paymentStatus, orderStatus) {
  const orderId = session.metadata?.order_id || null;

  const result = await query(
    `update public.orders
     set payment_status = $1,
         status = $2,
         stripe_session_id = coalesce(stripe_session_id, $3),
         stripe_payment_intent_id = coalesce($4, stripe_payment_intent_id)
     where id = $5 or stripe_session_id = $3
     returning id, user_id, account_balance_applied`,
    [
      paymentStatus,
      orderStatus,
      session.id,
      session.payment_intent || null,
      orderId
    ]
  );

  if (result.rowCount > 0 && orderStatus === "requested") {
    const updatedOrder = result.rows[0];
    const updatedOrderId = updatedOrder.id;

    if (paymentStatus === "paid" && updatedOrder.user_id && Number(updatedOrder.account_balance_applied) > 0) {
      await query(
        `update public.users
         set account_balance = greatest(account_balance - $1, 0)
         where id = $2`,
        [updatedOrder.account_balance_applied, updatedOrder.user_id]
      );
    }

    await notifyStaffForOrderStatus(
      updatedOrderId,
      orderStatus,
      "Paid Yo's order",
      "A paid online order is ready for front counter review."
    );
  }
}

export async function POST(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  await ensureOrderPaymentTracking();
  await ensureAccountBalanceSchema();

  const payload = await request.text();

  try {
    verifyStripeSignature(payload, request.headers.get("stripe-signature"));
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  const event = JSON.parse(payload);

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await updateOrderFromCheckoutSession(event.data.object, "paid", "requested");
    }

    if (event.type === "checkout.session.expired") {
      await updateOrderFromCheckoutSession(event.data.object, "expired", "cancelled");
    }

    if (event.type === "checkout.session.async_payment_failed") {
      await updateOrderFromCheckoutSession(event.data.object, "failed", "cancelled");
    }
  } catch (error) {
    console.error("Failed to process Stripe webhook.", error);
    return NextResponse.json({ message: "Unable to process webhook." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
