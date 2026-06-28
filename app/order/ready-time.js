const defaultReadyWindowMinutes = 15;
const defaultReadyTimeZone = "America/New_York";

export function getDefaultReadyTime(now = new Date()) {
  const readyAt = new Date(now.getTime() + defaultReadyWindowMinutes * 60 * 1000);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.ORDER_READY_TIME_ZONE || defaultReadyTimeZone
  }).format(readyAt);
}

export function normalizeReadyTime(value, fallbackValue = null) {
  const readyTime = String(value || "").trim();

  return readyTime || fallbackValue || getDefaultReadyTime();
}
