import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../../db";
import { ensureOrderPaymentTracking } from "../../../../order/payment-schema";
import { getUserForSessionToken, sessionCookieName } from "../../../../session";

export const dynamic = "force-dynamic";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request, { params }) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const [{ id }, user] = await Promise.all([
    params,
    getUserForSessionToken(request.cookies.get(sessionCookieName)?.value)
  ]);

  if (!user) {
    return NextResponse.json({ message: "Sign in to view this order." }, { status: 401 });
  }

  if (!isUuid(id)) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  await ensureOrderPaymentTracking();

  const result = await query(
    `select id, payment_status, ready_time, status, updated_at
     from public.orders
     where id = $1 and user_id = $2
     limit 1`,
    [id, user.id]
  );
  const order = result.rows[0];

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      paymentStatus: order.payment_status,
      readyTime: order.ready_time || "",
      status: order.status,
      updatedAt: order.updated_at
    }
  });
}
