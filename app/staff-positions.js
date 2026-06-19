export const staffPositions = new Set(["manager", "front", "prep", "expo", "delivery"]);

export const staffPositionStatusMap = {
  delivery: ["ready", "in_route"],
  expo: ["preparing", "ready"],
  front: ["payment_pending", "requested", "confirmed", "cancelled"],
  manager: null,
  prep: ["confirmed", "preparing"]
};

export function normalizeStaffPosition(position, fallback = "front") {
  const normalized = String(position || "").trim().toLowerCase();
  return staffPositions.has(normalized) ? normalized : fallback;
}

export function getVisibleStatusesForPosition(position) {
  return staffPositionStatusMap[normalizeStaffPosition(position)] || null;
}
