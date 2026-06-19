import { NextResponse } from "next/server";
import { query } from "../../../../../db";
import { ensureOrderPaymentTracking } from "../../../../../order/payment-schema";
import { requireAdmin } from "../../../admin-auth";
import { buildReceipt, serializeOrder, serializeOrderItem } from "../../orders-admin";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  await ensureOrderPaymentTracking();

  const { id } = await params;
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
  const orderRow = orderResult.rows[0];

  if (!orderRow) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const itemsResult = await query(
    `select id, order_id, menu_item_slug, item_name, special_instructions, quantity, unit_price, line_total
     from public.order_items
     where order_id = $1
     order by created_at asc`,
    [id]
  );
  const order = serializeOrder(orderRow, itemsResult.rows.map(serializeOrderItem));

  return NextResponse.json({
    order,
    receipt: buildReceipt(order)
  });
}
