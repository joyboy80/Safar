export const LIVE_STATUSES = new Set(["Running", "On Time", "Delayed"]);
export const LIVE_WINDOW_MS = 3 * 60 * 1000;

export const STATUS_COLORS = {
  "On Time": "#059669",
  Running: "#0f9488",
  Delayed: "#dc2626",
  Maintenance: "#f59e0b",
  Offline: "#64748b",
  Completed: "#94a3b8",
};

export function busPosition(bus) {
  const lat = Number(bus?.currentLocation?.lat);
  const lng = Number(bus?.currentLocation?.lng);
  if (bus?.currentLocation?.lat === null || bus?.currentLocation?.lng === null) return null;
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
}

export function isBusLive(bus, now = Date.now()) {
  if (!bus) return false;
  if (typeof bus.isLive === "boolean") return bus.isLive;
  if (!LIVE_STATUSES.has(bus.status) || !busPosition(bus)) return false;
  const updatedAt = Date.parse(bus.updatedAt || "");
  return Number.isFinite(updatedAt) && now - updatedAt < LIVE_WINDOW_MS;
}

export function formatUpdatedAgo(value, now = Date.now()) {
  const time = typeof value === "number" ? value : Date.parse(value || "");
  if (!Number.isFinite(time)) return "No GPS yet";
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : "over a day ago";
}

export function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
