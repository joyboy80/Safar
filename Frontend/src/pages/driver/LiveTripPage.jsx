import { CirclePause, CirclePlay, Flag, MapPin, Navigation, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import TripStatusBadge from "../../components/driver/TripStatusBadge";
import LiveBusDetails from "../../components/tracking/LiveBusDetails";
import LiveMap from "../../components/tracking/LiveMap";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../context/AuthContext";
import useLiveTracking from "../../hooks/useLiveTracking";
import DashboardLayout from "../../layouts/DashboardLayout";
import { getCurrentTrip, getTripSummary, updateTripStatus } from "../../services/driverService";
import { publishDriverLocation } from "../../services/trackingService";

export default function LiveTripPage() {
  const { setToast } = useAuth();
  const { buses } = useLiveTracking();
  const [summary, setSummary] = useState(null);
  const [endOpen, setEndOpen] = useState(false);

  async function load() {
    const trip = await getCurrentTrip();
    setSummary(trip ? await getTripSummary(trip.id) : { trip: null, passengerCount: 0, boarded: 0, waiting: 0 });
  }

  useEffect(() => { load(); }, []);

  async function setStatus(status) {
    const updated = await updateTripStatus(summary.trip.id, status);
    setSummary((current) => ({ ...current, trip: updated }));
    setToast({ type: "success", message: status === "Completed" ? "Trip completed and live tracking closed." : "Trip started. GPS updates are active." });
    setEndOpen(false);
  }

  const trip = summary?.trip;
  const liveBus = buses.find((bus) => bus.id === trip?.busId);
  const resolvedLiveBus = liveBus || {
    id: trip?.busId || "LIVE_BUS",
    name: trip?.busName || "Assigned Bus",
    currentLocation: { label: "CUET Transport Yard", lat: 22.4633, lng: 91.9745 },
    nextStop: trip?.stops?.[1] || "En Route",
    etaMinutes: 15,
    speed: 0,
    status: trip?.status || "Scheduled",
  };

  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | active | error
  const [gpsError, setGpsError] = useState("");

  useEffect(() => {
    if (trip?.status !== "In Progress") { setGpsStatus("idle"); return undefined; }
    if (!navigator.geolocation) { setGpsStatus("error"); setGpsError("GPS is not supported by this browser."); return undefined; }

    const isSecure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!isSecure) {
      setGpsStatus("error");
      setGpsError(`GPS requires HTTPS. Open this page using https://${location.hostname}:${location.port}${location.pathname} on your phone.`);
      return undefined;
    }

    setGpsStatus("active");
    setGpsError("");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus("active");
        setGpsError("");
        publishDriverLocation({
          tripId: trip.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: Math.max(0, (position.coords.speed || 0) * 3.6),
          locationLabel: "Live GPS position",
          nextStop: trip.nextStop,
          etaMinutes: Number.parseInt(trip.eta, 10) || 0,
          status: "Running",
          progress: 0,
        }).catch((error) => setToast({ type: "error", message: error.message }));
      },
      (error) => {
        setGpsStatus("error");
        const messages = {
          1: "Location permission denied. Please allow GPS access in your browser settings.",
          2: "Unable to determine your location. Make sure GPS is enabled on your device.",
          3: "Location request timed out. Retrying...",
        };
        setGpsError(messages[error.code] || error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [setToast, trip?.eta, trip?.id, trip?.nextStop, trip?.status]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader eyebrow="Live Operations" title="Live trip" description="Control the current trip while GPS, ETA, location, and passenger status update in real time." actions={trip && <TripStatusBadge status={trip.status} />} />
        
        {gpsStatus === "error" && <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"><MapPin className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">GPS Tracking Issue</p><p className="mt-1">{gpsError}</p></div></div>}
        {gpsStatus === "active" && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>GPS is active — broadcasting your location to all users</div>}

        {trip && <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [MapPin, "Current location", resolvedLiveBus.currentLocation.label],
              [Navigation, "Next stop", resolvedLiveBus.nextStop],
              [Flag, "ETA", `${resolvedLiveBus.etaMinutes} min`],
              [Users, "Passengers", `${summary.boarded} / ${summary.passengerCount} boarded`],
            ].map(([Icon, label, value]) => <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><Icon className="h-5 w-5 text-safar-teal" /><p className="mt-3 text-xs font-bold uppercase text-safar-gray">{label}</p><p className="mt-1 break-words font-bold text-safar-ink">{value}</p></div>)}
          </section>

          <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0"><LiveMap buses={[resolvedLiveBus]} selectedId={resolvedLiveBus.id} highlightedId={resolvedLiveBus.id} /></div>
            <LiveBusDetails bus={{ ...resolvedLiveBus, route: trip.route }} title="Assigned Bus Live GPS" highlighted />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-bold text-safar-ink">{trip.route}</h2><p className="mt-1 text-sm text-safar-gray">{trip.departureTime} - {trip.arrivalTime || "On Schedule"} | {resolvedLiveBus.speed} km/h</p></div><div className="grid gap-2 sm:grid-cols-3"><Button icon={CirclePlay} disabled={trip.status === "In Progress" || trip.status === "Completed"} onClick={() => setStatus("In Progress")}>Start Trip</Button><Link className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-safar-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50" to="/driver/delay"><CirclePause className="h-4 w-4" /> Report Delay</Link><Button variant="danger" icon={Flag} disabled={trip.status === "Completed"} onClick={() => setEndOpen(true)}>End Trip</Button></div></div>
          </section>

          {trip.stops?.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-safar-ink flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-safar-teal" />
                  Route Stoppages in Order ({trip.stops.length} Stops)
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-safar-mint text-safar-navy">
                  Database Verified
                </span>
              </div>
              <p className="text-xs text-safar-gray mb-4">
                Follow this authoritative stoppage sequence during your scheduled trip:
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {trip.stops.map((stop, index) => {
                  const isCurrent = liveBus?.nextStop === stop;
                  return (
                    <div
                      key={stop}
                      className={`flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-semibold border transition ${
                        isCurrent
                          ? "bg-teal-50 border-safar-teal text-safar-teal shadow-sm"
                          : "bg-slate-50 border-slate-200 text-safar-ink"
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isCurrent ? "bg-safar-teal text-white" : "bg-white text-safar-gray border border-slate-200"
                      }`}>
                        {index + 1}
                      </span>
                      <span className="truncate">{stop}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>}
      </div>
      <Modal open={endOpen} title="Complete this trip?" description="The trip will be marked completed and its live GPS status will close." confirmLabel="Complete Trip" onClose={() => setEndOpen(false)} onConfirm={() => setStatus("Completed")} />
    </DashboardLayout>
  );
}
