export const orderStatuses = new Set([
  "payment_pending",
  "requested",
  "confirmed",
  "preparing",
  "ready",
  "in_route",
  "completed",
  "cancelled"
]);

const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

function formatStatus(status) {
  if (!status) return "unknown";

  if (status === "in_route") {
    return "In route";
  }

  return status.replace(/_/g, " ");
}

function serializeOrderEvent(row) {
  return {
    actorName: row.actor_name,
    actorPosition: row.actor_position,
    actorRole: row.actor_role,
    createdAt: row.created_at,
    eventType: row.event_type,
    fromValue: row.from_value,
    id: row.id,
    note: row.note,
    toValue: row.to_value
  };
}

export function serializeOrder(row, items = [], events = []) {
  return {
    createdAt: row.created_at,
    customer: {
      email: row.customer_email,
      fullName: row.customer_name,
      phone: row.customer_phone
    },
    fulfillmentMethod: row.fulfillment_method,
    id: row.id,
    userId: row.user_id,
    items,
    deliveryAddress: row.delivery_address,
    deliveryTime: row.delivery_time || "",
    accountBalanceApplied: Number(row.account_balance_applied || 0),
    paymentPreference: row.payment_preference,
    paymentStatus: row.payment_status,
    status: row.status,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    updatedAt: row.updated_at,
    events: events.map(serializeOrderEvent)
  };
}

export function serializeOrderItem(row) {
  return {
    id: row.id,
    instructions: row.special_instructions,
    itemName: row.item_name,
    lineTotal: Number(row.line_total),
    menuItemSlug: row.menu_item_slug,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price)
  };
}

export function buildReceipt(order) {
  const lines = [
    "Yo's Caribbean Kitchen",
    `Receipt for order ${order.id.slice(0, 8)}`,
    new Date(order.createdAt).toLocaleString("en-US"),
    "",
    `Customer: ${order.customer.fullName}`,
    `Email: ${order.customer.email}`,
    `Phone: ${order.customer.phone || "Not provided"}`,
    `Fulfillment: ${order.fulfillmentMethod}`,
    order.deliveryAddress ? `Delivery address:\n${order.deliveryAddress}` : null,
    order.deliveryTime ? `Delivery time: ${order.deliveryTime}` : null,
    `Payment: ${order.paymentPreference}`,
    `Payment status: ${formatStatus(order.paymentStatus)}`,
    `Status: ${formatStatus(order.status)}`,
    "",
    "Items"
  ].filter(Boolean);

  for (const item of order.items) {
    lines.push(
      `${item.quantity} x ${item.itemName} @ ${formatter.format(item.unitPrice)} = ${formatter.format(item.lineTotal)}`
    );
    if (item.instructions) lines.push(`  Instructions: ${item.instructions}`);
  }

  lines.push(
    "",
    `Subtotal: ${formatter.format(order.subtotal)}`,
    `Tax: ${formatter.format(order.tax)}`,
    order.accountBalanceApplied > 0 ? `Back balance: ${formatter.format(order.accountBalanceApplied)}` : null,
    `Total: ${formatter.format(order.total)}`,
    "",
    "Thank you for ordering from Yo's Caribbean Kitchen."
  );

  return lines.join("\n");
}
