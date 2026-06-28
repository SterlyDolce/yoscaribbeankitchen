import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../db";
import { getUserForSessionToken, sessionCookieName } from "../../../session";

export const dynamic = "force-dynamic";

function formatOrderStatus(status) {
  if (!status) return "updated";
  if (status === "in_route") return "on the way";

  return status.replace(/_/g, " ");
}

export async function GET(request) {
  if (!hasDatabaseConfig()) {
    return NextResponse.json({ message: "Database is not configured." }, { status: 503 });
  }

  const user = await getUserForSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (!user) {
    return NextResponse.json({ message: "Sign in to view order updates." }, { status: 401 });
  }

  const result = await query(
    `select id, ready_time, status, updated_at
     from public.orders
     where user_id = $1
     order by updated_at desc
     limit 1`,
    [user.id]
  );
  const order = result.rows[0];

  if (!order) {
    return NextResponse.json({ message: "No orders found." }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      body: order.ready_time
        ? `Ready by ${order.ready_time}. Open your order tracker for details.`
        : "Open your order tracker for details.",
      id: order.id,
      readyTime: order.ready_time || "",
      status: order.status,
      title: `Order ${formatOrderStatus(order.status)}`,
      updatedAt: order.updated_at,
      url: `/orders/${order.id}`
    }
  });
}
