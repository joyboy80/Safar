import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { getCurrentTrip } from "../services/driverService";
import { publishDriverLocation } from "../services/trackingService";
import { distanceMeters } from "../utils/liveTracking";
import { useAuth } from "./AuthContext";

const DriverLiveTrackingContext = createContext(null);

const SEND_INTERVAL_MS = 4000;      // normal cadence while moving
const FAST_SEND_MIN_MS = 1500;      // allow quicker sends after a big move
const BIG_MOVE_METERS = 25;
const HEARTBEAT_MS = 20000;         // keep a parked bus "live" for viewers
const TRIP_REFRESH_MS = 30000;
export const DRIVER_TRIP_UPDATED_EVENT = "safar:driver-trip-updated";

export function notifyDriverTripUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DRIVER_TRIP_UPDATED_EVENT));
}

const GPS_ERRORS = {
  1: "Location permission denied. Please allow GPS access in your browser settings so passengers can see your bus.",
  2: "Unable to determine your location. Make sure GPS / Location is turned on for this device.",
  3: "Location request timed out. Retrying…",
};

export function DriverLiveTrackingProvider({ children }) {
  const { setToast } = useAuth();
  const [trip, setTrip] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | starting | active | sync-error | error
  const [gpsError, setGpsError] = useState("");
  const [lastFix, setLastFix] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);
  const tripRef = useRef(null);
  const lastFixRef = useRef(null);
  const lastSentRef = useRef({ at: 0, fix: null });
  const sendingRef = useRef(false);
  const syncErrorToastRef = useRef(false);
  const setToastRef = useRef(setToast);
  setToastRef.current = setToast;

  tripRef.current = trip;

  const refreshTrip = useCallback(async () => {
    try {
      const current = await getCurrentTrip();
      setTrip(current);
      return current;
    } catch {
      return tripRef.current;
    }
  }, []);

  useEffect(() => {
    refreshTrip();
    const timer = window.setInterval(refreshTrip, TRIP_REFRESH_MS);
    window.addEventListener(DRIVER_TRIP_UPDATED_EVENT, refreshTrip);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(DRIVER_TRIP_UPDATED_EVENT, refreshTrip);
    };
  }, [refreshTrip]);

  const tripId = trip?.id;
  const isLiveTrip = trip?.status === "In Progress";

  useEffect(() => {
    if (!isLiveTrip || !tripId) {
      setGpsStatus("idle");
      setGpsError("");
      setLastFix(null);
      lastFixRef.current = null;
      return undefined;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("GPS is not supported by this browser.");
      return undefined;
    }
    const isSecure = window.location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!isSecure) {
      setGpsStatus("error");
      setGpsError(`GPS requires HTTPS. Open this page using https://${window.location.host}${window.location.pathname} on your phone.`);
      return undefined;
    }

    setGpsStatus("starting");
    setGpsError("");
    lastSentRef.current = { at: 0, fix: null };
    syncErrorToastRef.current = false;
    let cancelled = false;

    const send = (fix, force = false) => {
      if (cancelled || sendingRef.current) return;
      const now = Date.now();
      const previous = lastSentRef.current;
      const elapsed = now - previous.at;
      const moved = distanceMeters(previous.fix, fix);
      const due = force || elapsed >= SEND_INTERVAL_MS || (moved >= BIG_MOVE_METERS && elapsed >= FAST_SEND_MIN_MS);
      if (!due) return;

      sendingRef.current = true;
      lastSentRef.current = { at: now, fix };
      const currentTrip = tripRef.current;
      const eta = Number.parseInt(currentTrip?.eta, 10);
      publishDriverLocation({
        tripId,
        latitude: fix.lat,
        longitude: fix.lng,
        speed: fix.speedKmh,
        locationLabel: "Live GPS position",
        status: "Running",
        ...(currentTrip?.nextStop ? { nextStop: currentTrip.nextStop } : {}),
        ...(Number.isFinite(eta) && eta > 0 ? { etaMinutes: eta } : {}),
      })
        .then(() => {
          if (cancelled) return;
          setLastSentAt(Date.now());
          setGpsStatus("active");
          setGpsError("");
          syncErrorToastRef.current = false;
        })
        .catch((error) => {
          if (cancelled) return;
          setGpsStatus("sync-error");
          setGpsError(`Couldn't send your location: ${error.message}. Retrying automatically…`);
          if (!syncErrorToastRef.current) {
            syncErrorToastRef.current = true;
            setToastRef.current?.({ type: "error", message: error.message });
          }
        })
        .finally(() => { sendingRef.current = false; });
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const previous = lastFixRef.current;
        const fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0),
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          timestamp: position.timestamp || Date.now(),
          speedKmh: 0,
        };
        if (Number.isFinite(position.coords.speed) && position.coords.speed !== null) {
          fix.speedKmh = Math.max(0, position.coords.speed * 3.6);
        } else if (previous) {
          // Some phones don't report speed; derive it from consecutive fixes.
          const seconds = (fix.timestamp - previous.timestamp) / 1000;
          if (seconds > 0.5) fix.speedKmh = Math.min(140, distanceMeters(previous, fix) / seconds * 3.6);
        }
        fix.speedKmh = Math.round(fix.speedKmh);
        lastFixRef.current = fix;
        setLastFix(fix);
        setGpsStatus((status) => (status === "sync-error" ? status : "active"));
        send(fix);
      },
      (error) => {
        if (cancelled) return;
        setGpsStatus("error");
        setGpsError(GPS_ERRORS[error.code] || error.message);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );

    const heartbeat = window.setInterval(() => {
      if (lastFixRef.current && Date.now() - lastSentRef.current.at >= HEARTBEAT_MS) send(lastFixRef.current, true);
    }, 5000);

    // Keep the phone screen awake while the trip is live (where supported).
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if (document.visibilityState === "visible" && navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request("screen");
      } catch { /* not supported or denied */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
        if (lastFixRef.current) send(lastFixRef.current, true);
      }
    };
    requestWakeLock();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLock?.release?.().catch(() => {});
    };
  }, [isLiveTrip, tripId]);

  const value = useMemo(() => ({
    trip,
    isLiveTrip,
    gpsStatus,
    gpsError,
    lastFix,
    lastSentAt,
    refreshTrip,
  }), [gpsError, gpsStatus, isLiveTrip, lastFix, lastSentAt, refreshTrip, trip]);

  return <DriverLiveTrackingContext.Provider value={value}>{children}</DriverLiveTrackingContext.Provider>;
}

const fallback = { trip: null, isLiveTrip: false, gpsStatus: "idle", gpsError: "", lastFix: null, lastSentAt: null, refreshTrip: async () => null };

export function useDriverLiveTracking() {
  return useContext(DriverLiveTrackingContext) || fallback;
}

function DriverLiveIndicator() {
  const { isLiveTrip, gpsStatus } = useDriverLiveTracking();
  const { pathname } = useLocation();
  if (!isLiveTrip || pathname === "/driver/live-trip") return null;
  const problem = gpsStatus === "error" || gpsStatus === "sync-error";
  return (
    <Link to="/driver/live-trip"
      className={`focus-ring fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-bold shadow-float ring-1 backdrop-blur-xl transition hover:-translate-y-0.5 ${problem ? "bg-red-600/95 text-white ring-red-500" : "bg-white/95 text-safar-ink ring-black/5 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-white/10"}`}>
      <span className="relative flex h-2.5 w-2.5">
        {!problem && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
        <span className={`relative h-2.5 w-2.5 rounded-full ${problem ? "bg-white" : "bg-emerald-500"}`} />
      </span>
      {problem ? "GPS issue · tap to fix" : gpsStatus === "starting" ? "Finding GPS…" : "Live trip · sharing location"}
    </Link>
  );
}

export function DriverLiveTrackingLayout() {
  return (
    <DriverLiveTrackingProvider>
      <Outlet />
      <DriverLiveIndicator />
    </DriverLiveTrackingProvider>
  );
}
