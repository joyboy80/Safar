import { apiRequest } from "./api.js";

export async function getLiveLocations() {
  return (await apiRequest("/transport/tracking")).buses;
}

export async function getLiveBus(busId) {
  return (await apiRequest(`/transport/tracking/${encodeURIComponent(busId)}`)).bus;
}

export const TRACKING_POLL_MS = 4000;

export function subscribeToTracking(listener, onError) {
  let active = true;
  let inFlight = false;
  const poll = async () => {
    if (!active || inFlight) return;
    // Skip polling while the tab is hidden; refresh immediately when it comes back.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    inFlight = true;
    try {
      const buses = await getLiveLocations();
      if (active) listener(buses);
    } catch (error) {
      if (active) onError?.(error);
    } finally {
      inFlight = false;
    }
  };
  const onVisibility = () => { if (document.visibilityState === "visible") poll(); };
  poll();
  const timer = typeof window !== "undefined" ? window.setInterval(poll, TRACKING_POLL_MS) : null;
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  return () => {
    active = false;
    if (timer) window.clearInterval(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  };
}

export async function publishDriverLocation(location) {
  return (await apiRequest("/driver/transport/location", { method: "PUT", body: location })).location;
}
