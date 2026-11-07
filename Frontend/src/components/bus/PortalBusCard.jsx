import { BusFront, Clock, Eye, MapPin, Navigation, Ticket, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../common/Badge";
import { getBusAccent } from "../../utils/busIdentity";

function toneForStatus(status) {
  if (status === "Delayed") return "danger";
  if (status === "Boarding") return "warning";
  if (status === "Arrived") return "neutral";
  return "success";
}

export default function PortalBusCard({ bus, role, date }) {
  const dateParam = date ? `date=${encodeURIComponent(date)}` : "";
  const busIdVal = bus.busId || bus.id;
  const tripParam = bus.scheduleId || bus.tripId ? `&tripId=${encodeURIComponent(bus.scheduleId || bus.tripId)}` : "";
  const detailsTo = `/${role}/buses/${encodeURIComponent(busIdVal)}${dateParam ? `?${dateParam}` : ""}`;
  const reserveTo = `/${role}/reservations/new?busId=${encodeURIComponent(busIdVal)}${dateParam ? `&${dateParam}` : ""}${tripParam}`;

  return (
    <article className={`bus-card ${getBusAccent(bus.name)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bus-icon grid h-11 w-11 shrink-0 place-items-center rounded-lg"><BusFront className="h-5 w-5" /></div>
          <div className="min-w-0"><h3 className="text-lg font-extrabold text-safar-ink">{bus.name}</h3>
          <p className="mt-1 text-sm text-safar-gray">{bus.type}</p>
          </div>
        </div>
        <Badge tone={toneForStatus(bus.status)}>{bus.status}</Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-safar-gray sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin className="bus-color h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate" title={bus.route}>{bus.route}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="bus-color h-4 w-4 shrink-0" />
          <span>{bus.departureTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="bus-color h-4 w-4 shrink-0" />
          <span>{bus.availableSeats ?? bus.capacity} seats available</span>
        </div>
        <div className="flex items-center gap-2">
          <Navigation className="bus-color h-4 w-4 shrink-0" />
          <span>Driver: {bus.driverName || "Assigned"}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <Link
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/50 backdrop-blur-md px-3 py-2.5 text-sm font-semibold text-safar-ink shadow-sm ring-1 ring-slate-200/50 transition-all duration-300 hover:bg-white/80 hover:shadow-glow dark:bg-slate-800/50 dark:text-white dark:ring-slate-700/50 dark:hover:bg-slate-700/80"
          to={detailsTo}
        >
          <Eye className="h-4 w-4" />
          View Details
        </Link>
        <Link
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-maroon to-brand-purple px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:shadow-glow hover:-translate-y-0.5"
          to={reserveTo}
        >
          <Ticket className="h-4 w-4" />
          Reserve Seat
        </Link>
        <Link
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-cyan to-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:shadow-glow hover:-translate-y-0.5"
          to={`/${role}/tracking`}
        >
          <Navigation className="h-4 w-4" />
          Track
        </Link>
      </div>
    </article>
  );
}
