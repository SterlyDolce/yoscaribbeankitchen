import { NextResponse } from "next/server";
import { ensureAccountBalanceSchema } from "../../../../account-balance-schema";
import { notifyCustomerForOrderStatus } from "../../../../customer-notifications";
import { query, transaction } from "../../../../db";
import { ensureOrderAuditSchema, recordOrderEvent } from "../../../../order/audit-schema";
import { ensureOrderPaymentTracking } from "../../../../order/payment-schema";
import { notifyStaffForOrderStatus } from "../../../../staff-notifications";
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

const paymentStatuses = new Set(["paid"]);
const paymentCollectionPositions = new Set(["front", "delivery"]);

function canUpdateStatus(staffUser, order, nextStatus) {
  if (!staffUser || staffUser.staffPosition === "manager") {
    return true;
  }

  return positionTransitions[staffUser.staffPosition]?.[order.status]?.includes(nextStatus) || false;
}

function canUpdatePayment(staffUser, order, nextPaymentStatus) {
  if (!staffUser || staffUser.staffPosition === "manager") {
    return true;
  }

  if (nextPaymentStatus !== "paid" || order.paymentStatus !== "pay_in_person") {
    return false;
  }

  return paymentCollectionPositions.has(staffUser.staffPosition);
}

async function getOrder(id, visibleStatuses = null) {
  await ensureOrderPaymentTracking();
  await ensureOrderAuditSchema();
  await ensureAccountBalanceSchema();

  const values = [id];
  const visibilityClause = visibleStatuses ? `and o.status = any($2::text[])` : "";
  if (visibleStatuses) values.push(visibleStatuses);

  const orderResult = await query(
    `select
       o.id,
       o.user_id,
	       o.fulfillment_method,
	       o.payment_preference,
	       o.payment_status,
	       o.delivery_address,
       o.delivery_time,
       o.ready_time,
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

  const eventsResult = await query(
    `select id, event_type, from_value, to_value, note, actor_name, actor_role, actor_position, created_at
     from public.order_events
     where order_id = $1
     order by created_at desc
     limit 50`,
    [id]
  );

  return serializeOrder(order, itemsResult.rows.map(serializeOrderItem), eventsResult.rows);
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
  const status = body.status === undefined ? "" : String(body.status).trim().toLowerCase();
  const paymentStatus = body.paymentStatus === undefined ? "" : String(body.paymentStatus).trim().toLowerCase();

  if (!status && !paymentStatus) {
    return NextResponse.json({ message: "Choose an order update." }, { status: 400 });
  }

  if (status && !orderStatuses.has(status)) {
    return NextResponse.json({ message: "Choose a valid order status." }, { status: 400 });
  }

  if (paymentStatus && !paymentStatuses.has(paymentStatus)) {
    return NextResponse.json({ message: "Choose a valid payment status." }, { status: 400 });
  }

  if (status && !canUpdateStatus(staffUser, currentOrder, status)) {
    return NextResponse.json({ message: "This staff position cannot move the order to that status." }, { status: 403 });
  }

  if (paymentStatus && !canUpdatePayment(staffUser, currentOrder, paymentStatus)) {
    return NextResponse.json({ message: "This staff position cannot update that payment status." }, { status: 403 });
  }

  const nextPaymentStatus = paymentStatus || currentOrder.paymentStatus;
  if (status === "completed" && nextPaymentStatus !== "paid") {
    return NextResponse.json(
      { message: "Mark pay-in-person payment as paid before completing this order." },
      { status: 409 }
    );
  }

  const fields = [];
  const values = [];
  if (status) {
    values.push(status);
    fields.push(`status = $${values.length}`);
  }
  if (paymentStatus) {
    values.push(paymentStatus);
    fields.push(`payment_status = $${values.length}`);
  }
  values.push(id);

  const result = await transaction(async (client) => {
    const updateResult = await client.query(
      `update public.orders
       set ${fields.join(", ")}
       where id = $${values.length}
       returning id`,
      values
    );

    if (updateResult.rowCount === 0) {
      return updateResult;
    }

    if (status && status !== currentOrder.status) {
      await recordOrderEvent(client, currentOrder, staffUser, "status", currentOrder.status, status);
    }

    if (paymentStatus && paymentStatus !== currentOrder.paymentStatus) {
      await recordOrderEvent(
        client,
        currentOrder,
        staffUser,
        "payment_status",
        currentOrder.paymentStatus,
        paymentStatus
      );

      if (paymentStatus === "paid" && currentOrder.userId && currentOrder.accountBalanceApplied > 0) {
        await client.query(
          `update public.users
           set account_balance = greatest(account_balance - $1, 0)
           where id = $2`,
          [currentOrder.accountBalanceApplied, currentOrder.userId]
        );
      }
    }

    return updateResult;
  });

  if (result.rowCount === 0) {
    return NextResponse.json({ message: "Order not found." }, { status: 404 });
  }

  const order = await getOrder(id);
  if (status && status !== currentOrder.status) {
    await notifyStaffForOrderStatus(
      id,
      status,
      "Order moved",
      `Order ${id.slice(0, 8)} is now ${status.replace(/_/g, " ")}.`
    );
    await notifyCustomerForOrderStatus(id, status);
  }
  return NextResponse.json({ order });
}
