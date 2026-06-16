import { NextResponse } from "next/server";
import { query } from "../../../db";
import { requireAdmin } from "../admin-auth";
import { serializeOrder, serializeOrderItem } from "./orders-admin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number.parseInt(params.get("limit") || "50", 10), 100);
  const status = params.get("status");
  const values = [];
  const where = [];

  if (status) {
    values.push(status);
    where.push(`o.status = $${values.length}`);
  }

  values.push(limit);

  const ordersResult = await query(
    `select
       o.id,
       o.fulfillment_method,
       o.payment_preference,
       o.delivery_address,
       o.status,
       o.subtotal,
       o.tax,
       o.total,
       o.created_at,
       o.updated_at,
       u.full_name as customer_name,
       u.email as customer_email,
       u.phone as customer_phone
     from public.orders o
     join public.users u on u.id = o.user_id
     ${where.length > 0 ? `where ${where.join(" and ")}` : ""}
     order by o.created_at desc
     limit $${values.length}`,
    values
  );

  const orders = ordersResult.rows;

  if (orders.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  const itemsResult = await query(
    `select id, order_id, menu_item_slug, item_name, special_instructions, quantity, unit_price, line_total
     from public.order_items
     where order_id = any($1::uuid[])
     order by created_at asc`,
    [orders.map((order) => order.id)]
  );
  const itemsByOrderId = new Map();

  for (const item of itemsResult.rows) {
    const currentItems = itemsByOrderId.get(item.order_id) || [];
    currentItems.push(serializeOrderItem(item));
    itemsByOrderId.set(item.order_id, currentItems);
  }

  return NextResponse.json({
    orders: orders.map((order) => serializeOrder(order, itemsByOrderId.get(order.id) || []))
  });
}
