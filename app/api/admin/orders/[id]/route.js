import { NextResponse } from "next/server";
import { query } from "../../../../db";
import { ensureOrderPaymentTracking } from "../../../../order/payment-schema";
import { getStaffUserForRequest, requireAdmin } from "../../admin-auth";
import { getVisibleStatusesForPosition } from "../../../../staff-positions";
import { orderStatuses, serializeOrder, serializeOrderItem } from "../orders-admin";

export const dynamic = "force-dynamic";

const positionTransitions = {
  delivery: {
    in_route: ["completed"],
    ready: ["in_route"]
  },
  expo: {
    preparing: ["ready"]
  },
  front: {
    requested: ["cancelled", "confirmed"]
  },
  prep: {
    confirmed: ["preparing"],
    preparing: ["ready"]
  }
};

function canUpdateStatus(staffUser, order, nextStatus) {
  if (!staffUser || staffUser.staffPosition === "manager") {
    return true;
  }

  return positionTransitions[staffUser.staffPosition]?.[order.status]?.includes(nextStatus) || false;
}

async function getOrder(id, visibleStatuses = null) {
  await ensureOrderPaymentTracking();

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
	     ${visibilityClause}
	     limit 1`,
    values
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
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const staffUser = await getStaffUserForRequest(request);
  const visibleStatuses = staffUser ? getVisibleStatusesForPosition(staffUser.staffPosition) : null;
  const order = await getOrder(id, visibleStatuses);

  if (!order) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const staffUser = await getStaffUserForRequest(request);
  const visibleStatuses = staffUser ? getVisibleStatusesForPosition(staffUser.staffPosition) : null;
  const currentOrder = await getOrder(id, visibleStatuses);

  if (!currentOrder) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const body = await request.json();
  const status = String(body.status || "").trim().toLowerCase();

  if (!orderStatuses.has(status)) {
    return NextResponse.json({ message: "Choose a valid order status." }, { status: 400 });
  }

  if (!canUpdateStatus(staffUser, currentOrder, status)) {
    return NextResponse.json({ message: "This staff position cannot move the order to that status." }, { status: 403 });
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
