import { NextResponse } from "next/server";
import { ensureAccountBalanceSchema } from "../../../../../account-balance-schema";
import { query } from "../../../../../db";
import { ensureOrderPaymentTracking } from "../../../../../order/payment-schema";
import { getStaffUserForRequest, requireAdmin } from "../../../admin-auth";
import { getVisibleStatusesForPosition } from "../../../../../staff-positions";
import { buildReceipt, serializeOrder, serializeOrderItem } from "../../orders-admin";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  await ensureOrderPaymentTracking();
  await ensureAccountBalanceSchema();

  const { id } = await params;
  const staffUser = await getStaffUserForRequest(request);
  const visibleStatuses = staffUser ? getVisibleStatusesForPosition(staffUser.staffPosition) : null;
  const values = [id];
  const visibilityClause = visibleStatuses ? `and o.status = any($2::text[])` : "";
  if (visibleStatuses) values.push(visibleStatuses);

  const orderResult = await query(
    `select
       o.id,
	       o.fulfillment_method,
	       o.payment_preference,
	       o.payment_status,
	       o.delivery_address,
       o.delivery_time,
       o.status,
       o.subtotal,
       o.tax,
       o.account_balance_applied,
       o.total,
       o.created_at,
       o.updated_at,
       coalesce(u.full_name, o.guest_name) as customer_name,
       coalesce(u.email, o.guest_email) as customer_email,
       coalesce(u.phone, o.guest_phone) as customer_phone
	     from public.orders o
	     left join public.users u on u.id = o.user_id
	     where o.id = $1
	     ${visibilityClause}
	     limit 1`,
    values
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
