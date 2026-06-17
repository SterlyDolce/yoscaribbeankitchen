export function getMenuItemCustomization(item) {

  const groups = Array.isArray(item.customizationGroups) ? item.customizationGroups : [];
  return groups.length > 0 ? { groups } : null;
}

export function requiresMealOptions(item) {
  //return item.category === "main";
  return false; // --- IGNORE ---
}

export function validateMenuItemSelections(item, selections = {}) {
  const customization = getMenuItemCustomization(item);


  if (!customization) {
    return requiresMealOptions(item)
      ? { message: `${item.name} customization options are not available yet.`, selections: {}, valid: false }
      : { priceAdjustment: 0, selections: {}, valid: true };
  }

  const normalized = {};
  let priceAdjustment = 0;

  for (const group of customization.groups) {
    const optionsById = new Map(group.options.map((option) => [option.id, option]));
    const selected = Array.isArray(selections[group.id])
      ? [...new Set(selections[group.id].map(String))].filter((id) => optionsById.has(id))
      : [];

    if (selected.length < group.min || selected.length > group.max) {
      return { message: `${group.label} for ${item.name}.`, selections: normalized, valid: false };
    }

    normalized[group.id] = selected;
    priceAdjustment += selected.reduce(
      (total, id) => total + optionsById.get(id).priceAdjustment,
      0
    );
  }

  return { priceAdjustment, selections: normalized, valid: true };
}

export function formatMenuItemSelections(item, selections = {}) {
  console.log("formatMenuItemSelections called with item:", item, "selections:", selections); // --- DEBUG ---
  const customization = getMenuItemCustomization(item);
  if (!customization) return "";

  return customization.groups
    .map((group) => {
      const labels = new Map(group.options.map((option) => [option.id, option.label]));
      const selectedLabels = (selections[group.id] || []).map((id) => labels.get(id)).filter(Boolean);
      return selectedLabels.length > 0 ? `${group.name}: ${selectedLabels.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("; ");
}

export function getMenuItemUnitPrice(item, selections = {}) {
  const result = validateMenuItemSelections(item, selections);
  return item.price + (result.valid ? result.priceAdjustment : 0);
}
