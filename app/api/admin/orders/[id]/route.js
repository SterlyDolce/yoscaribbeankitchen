import { NextResponse } from "next/server";
import { query } from "../../../../db";
import { ensureOrderPaymentTracking } from "../../../../order/payment-schema";
import { requireAdmin } from "../../admin-auth";
import { orderStatuses, serializeOrder, serializeOrderItem } from "../orders-admin";

export const dynamic = "force-dynamic";

async function getOrder(id) {
  await ensureOrderPaymentTracking();

  const orderResult = await query(
    `select
       o.id,
	       o.fulfillment_method,
	       o.payment_preference,
	       o.payment_status,
	       o.delivery_address,
       o.status,
       o.subtotal,
       o.tax,
       o.total,
       o.created_at,
       o.updated_at,
       coalesce(u.full_name, o.guest_name) as customer_name,
       coalesce(u.email, o.guest_email) as customer_email,
       coalesce(u.phone, o.guest_phone) as customer_phone
     from public.orders o
     left join public.users u on u.id = o.user_id
     where o.id = $1
     limit 1`,
    [id]
  );
  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  const itemsResult = await query(
    `select id, order_id, menu_item_slug, item_name, special_instructions, quantity, unit_price, line_total
     from public.order_items
     where order_id = $1
     order by created_at asc`,
    [id]
  );

  return serializeOrder(order, itemsResult.rows.map(serializeOrderItem));
}

export async function GET(request, { params }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(request, { params }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const status = String(body.status || "").trim().toLowerCase();

  if (!orderStatuses.has(status)) {
    return NextResponse.json({ message: "Choose a valid order status." }, { status: 400 });
  }

  const result = await query(
    `update public.orders
     set status = $1
     where id = $2
     returning id`,
    [status, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const order = await getOrder(id);
  return NextResponse.json({ order });
}
