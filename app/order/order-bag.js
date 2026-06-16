export const orderBagStorageKey = "yos-order-bag";

export function readOrderBag() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = JSON.parse(window.localStorage.getItem(orderBagStorageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeOrderBag(items) {
  window.localStorage.setItem(orderBagStorageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("order-bag-change"));
}

function normalizeSelections(selections = {}) {
  return Object.fromEntries(
    Object.entries(selections)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([group, values]) => [group, Array.isArray(values) ? [...values].sort() : []])
  );
}

export function addToOrderBag(item) {
  const bag = readOrderBag();
  const normalizedInstructions = item.instructions.trim();
  const normalizedSelections = normalizeSelections(item.selections);
  const selectionKey = JSON.stringify(normalizedSelections);
  const existingIndex = bag.findIndex(
    (line) => line.slug === item.slug &&
      line.instructions === normalizedInstructions &&
      JSON.stringify(normalizeSelections(line.selections)) === selectionKey
  );

  if (existingIndex >= 0) {
    bag[existingIndex] = {
      ...bag[existingIndex],
      quantity: bag[existingIndex].quantity + item.quantity
    };
  } else {
    bag.push({
      instructions: normalizedInstructions,
      quantity: item.quantity,
      selections: normalizedSelections,
      slug: item.slug
    });
  }

  writeOrderBag(bag);
}
