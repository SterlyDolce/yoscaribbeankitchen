const serviceAreaCities = [
  "Pompano Beach",
  "Deerfield Beach",
  "Margate",
  "Oakland Park",
  "Coconut Creek",
  "Lighthouse Point",
  "North Lauderdale",
  "Tamarac",
  "Lauderdale Lakes",
  "Lauderdale-by-the-Sea",
  "Wilton Manors",
  "Fort Lauderdale"
];

const serviceAreaCityKeys = new Set(serviceAreaCities.map(normalizeCity));
const serviceAreaStates = new Set(["FL", "Florida"].map(normalizeState));

export const serviceAreaSummary = "Pompano Beach, Deerfield Beach, Margate, Oakland Park, and nearby cities in between.";

function normalizeCity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeState(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
}

export function getServiceAreaCities() {
  return serviceAreaCities;
}

export function isAddressInServiceArea(customer = {}) {
  const city = normalizeCity(customer.city);
  const state = normalizeState(customer.state);

  if (!city || !state) {
    return false;
  }

  return serviceAreaCityKeys.has(city) && serviceAreaStates.has(state);
}

export function getServiceAreaError(customer = {}) {
  if (!customer.city || !customer.state) {
    return "Enter your city and state so we can confirm delivery is available.";
  }

  if (!isAddressInServiceArea(customer)) {
    return `Delivery is only available in ${serviceAreaSummary}`;
  }

  return null;
}
