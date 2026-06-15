export const orderStatuses = new Set([
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
  if (status === "in_route") {
    return "In route";
  }

  return status.replace(/_/g, " ");
}

export function serializeOrder(row, items = []) {
  return {
    createdAt: row.created_at,
    customer: {
      email: row.customer_email,
      fullName: row.customer_name,
      phone: row.customer_phone
    },
    fulfillmentMethod: row.fulfillment_method,
    id: row.id,
    items,
    deliveryAddress: row.delivery_address,
    paymentPreference: row.payment_preference,
    status: row.status,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    updatedAt: row.updated_at
  };
}

export function serializeOrderItem(row) {
  return {
    id: row.id,
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
    `Payment: ${order.paymentPreference}`,
    `Status: ${formatStatus(order.status)}`,
    "",
    "Items"
  ].filter(Boolean);

  for (const item of order.items) {
    lines.push(
      `${item.quantity} x ${item.itemName} @ ${formatter.format(item.unitPrice)} = ${formatter.format(item.lineTotal)}`
    );
  }

  lines.push(
    "",
    `Subtotal: ${formatter.format(order.subtotal)}`,
    `Tax: ${formatter.format(order.tax)}`,
    `Total: ${formatter.format(order.total)}`,
    "",
    "Thank you for ordering from Yo's Caribbean Kitchen."
  );

  return lines.join("\n");
}
