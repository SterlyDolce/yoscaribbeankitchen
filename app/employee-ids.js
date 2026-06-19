export function normalizeEmployeeId(value) {
  return String(value || "").trim();
}

export function isEmployeeId(value) {
  return /^\d{6}$/.test(normalizeEmployeeId(value));
}
