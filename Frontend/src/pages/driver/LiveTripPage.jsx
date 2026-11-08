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
import { notifyDriverTripUpdated, useDriverLiveTracking } from "../../context/DriverLiveTrackingContext";
import useLiveTracking from "../../hooks/useLiveTracking";
import DashboardLayout from "../../layouts/DashboardLayout";
import { getCurrentTrip, getTripSummary, updateTripStatus } from "../../services/driverService";
import { formatUpdatedAgo } from "../../utils/liveTracking";

export default function LiveTripPage() {
  const { setToast } = useAuth();
  const { buses } = useLiveTracking();
  const { gpsStatus, gpsError, lastFix, lastSentAt } = useDriverLiveTracking();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 3000);
    return () => window.clearInterval(timer);
  }, []);
  const [summary, setSummary] = useState(null);
  const [endOpen, setEndOpen] = useState(false);

  async function load() {
    const trip = await getCurrentTrip();
    setSummary(trip ? await getTripSummary(trip.id) : { trip: null, passengerCount: 0, boarded: 0, waiting: 0 });
  }

  useEffect(() => { load(); }, []);

  async function setStatus(status) {
    let updated;
    try {
      updated = await updateTripStatus(summary.trip.id, status);
    } catch (error) {
      setToast({ type: "error", message: error.message });
      setEndOpen(false);
      return;
    }
    setSummary((current) => ({ ...current, trip: { ...current.trip, ...updated, status: updated?.status || status } }));
    notifyDriverTripUpdated();
    setToast({ type: "success", message: status === "Completed" ? "Trip completed and live tracking closed." : "Trip started. Live fleet is on — your bus is now visible to passengers and admins." });
    setEndOpen(false);
  }

  const trip = summary?.trip;
  const liveBus = buses.find((bus) => bus.id === trip?.busId);
  const resolvedLiveBus = liveBus || {
    id: trip?.busId || "LIVE_BUS",
    name: trip?.busName || "Assigned Bus",
    currentLocation: { label: "Waiting for GPS", lat: null, lng: null },
    nextStop: trip?.stops?.[1] || "En Route",
    etaMinutes: 15,
    speed: 0,
    status: trip?.status || "Scheduled",
  };
  const isTripLive = trip?.status === "In Progress";
  const mapBus = isTripLive && lastFix ? {
    ...resolvedLiveBus,
    currentLocation: { ...resolvedLiveBus.currentLocation, lat: lastFix.lat, lng: lastFix.lng, label: resolvedLiveBus.currentLocation?.label || "Live GPS position" },
    speed: lastFix.speedKmh,
    status: resolvedLiveBus.status === "Scheduled" ? "Running" : resolvedLiveBus.status,
    updatedAt: new Date(lastFix.timestamp).toISOString(),
    isLive: gpsStatus === "active",
  } : resolvedLiveBus;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader eyebrow="Live Operations" title="Live trip" description="Control the current trip while GPS, ETA, location, and passenger status update in real time." actions={trip && <TripStatusBadge status={trip.status} />} />
        
        {gpsStatus === "error" && <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"><MapPin className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">GPS Tracking Issue</p><p className="mt-1">{gpsError}</p></div></div>}
        {gpsStatus === "starting" && <div className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-500" />Finding your GPS position… If your browser asks, tap <b>Allow</b> location access.</div>}
        {isTripLive && lastFix?.accuracy > 300 && <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"><MapPin className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Location is approximate (±{lastFix.accuracy >= 1000 ? `${(lastFix.accuracy / 1000).toFixed(1)} km` : `${lastFix.accuracy} m`})</p><p className="mt-1">This device is not giving a real GPS fix — laptops and desktops use Wi-Fi/IP location. For accurate tracking, run the trip on the driver's phone with Location (GPS) turned on and set to high accuracy.</p></div></div>}
        {gpsStatus === "sync-error" && <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"><MapPin className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Connection issue</p><p className="mt-1">{gpsError}</p></div></div>}
        {gpsStatus === "active" && <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:flex-row sm:items-center sm:justify-between dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"><span className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>GPS is active — broadcasting your location to all users and admins</span><span className="text-xs font-medium opacity-80">Last sent {lastSentAt ? formatUpdatedAgo(lastSentAt, now) : "—"}{lastFix?.accuracy ? ` · ±${lastFix.accuracy} m` : ""}</span></div>}
        {trip && !isTripLive && trip.status !== "Completed" && gpsStatus === "idle" && <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-safar-gray ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"><CirclePlay className="h-4 w-4 text-safar-teal" />Press <b className="text-safar-ink">Start Trip</b> to go live — your bus will appear on every live fleet map.</div>}

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
            <div className="min-w-0"><LiveMap buses={[mapBus]} selectedId={mapBus.id} highlightedId={mapBus.id} follow={isTripLive} autoLocate={isTripLive} liveOnly={false} /></div>
            <LiveBusDetails bus={{ ...mapBus, route: trip.route }} title="Assigned Bus Live GPS" highlighted />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-bold text-safar-ink">{trip.route}</h2><p className="mt-1 text-sm text-safar-gray">{trip.departureTime} - {trip.arrivalTime || "On Schedule"} | {mapBus.speed} km/h</p></div><div className="grid gap-2 sm:grid-cols-3"><Button icon={CirclePlay} disabled={trip.status === "In Progress" || trip.status === "Completed"} onClick={() => setStatus("In Progress")}>Start Trip</Button><Link className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-safar-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50" to="/driver/delay"><CirclePause className="h-4 w-4" /> Report Delay</Link><Button variant="danger" icon={Flag} disabled={trip.status === "Completed"} onClick={() => setEndOpen(true)}>End Trip</Button></div></div>
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
