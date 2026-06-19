import { formatMenuItemSelections, validateMenuItemSelections } from "../menu-customizations";

export const taxRate = 0.07;
export const serviceFeeAmount = 1.75;
export const deliveryFeeAmount = 1.25;

export function money(value) {
  return Math.round(value * 100) / 100;
}

export function buildRequestedItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      instructions: String(item.instructions || "").trim().slice(0, 300),
      quantity: Number.parseInt(item.quantity, 10),
      selections: item.selections && typeof item.selections === "object" ? item.selections : {},
      slug: String(item.slug || "")
    }))
    .filter((item) => item.slug && Number.isInteger(item.quantity) && item.quantity > 0);
}

export function buildOrderLines(requestedItems, menuBySlug) {
  const orderLines = [];

  for (const requestedItem of requestedItems) {
    const menuItem = menuBySlug.get(requestedItem.slug);
    const selectionResult = validateMenuItemSelections(menuItem, requestedItem.selections);

    if (!selectionResult.valid) {
      return { message: selectionResult.message, valid: false };
    }

    const unitPrice = Number(menuItem.price) + selectionResult.priceAdjustment;
    const lineTotal = money(unitPrice * requestedItem.quantity);
    const mealSelections = formatMenuItemSelections(menuItem, selectionResult.selections);
    const instructions = [mealSelections, requestedItem.instructions]
      .filter(Boolean)
      .join("; ")
      .slice(0, 600);

    orderLines.push({
      instructions,
      lineTotal,
      menuItem,
      quantity: requestedItem.quantity,
      unitPrice
    });
  }

  return { orderLines, valid: true };
}

export function calculateOrderTotals(orderLines, fulfillmentMethod) {
  const subtotal = money(orderLines.reduce((total, line) => total + line.lineTotal, 0));
  const tax = money(subtotal * taxRate);
  const serviceFee = orderLines.length > 0 ? serviceFeeAmount : 0;
  const deliveryFee = fulfillmentMethod === "Delivery" && orderLines.length > 0 ? deliveryFeeAmount : 0;
  const total = money(subtotal + tax + serviceFee + deliveryFee);

  return {
    deliveryFee,
    serviceFee,
    subtotal,
    tax,
    total
  };
}
