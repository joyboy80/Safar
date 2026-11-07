import { AlertTriangle, Armchair, BusFront, CalendarDays, CircleAlert, ClipboardCheck, Siren, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminStatusBadge from "../../components/admin/AdminStatusBadge";
import DashboardBusCarousel from "../../components/common/DashboardBusCarousel";
import FeaturedBusPhotosManager from "../../components/admin/FeaturedBusPhotosManager";
import StatCard from "../../components/common/StatCard";
import ErrorState from "../../components/common/ErrorState";
import PageHeader from "../../components/layout/PageHeader";
import DashboardLayout from "../../layouts/DashboardLayout";
import { getAdminOverview } from "../../services/adminService";

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminOverview().then(setOverview).catch((requestError) => setError(requestError.message));
  }, []);

  const stats = overview?.stats || {};
  const statCards = [
    [BusFront, "Total Buses", stats.totalBuses || 0, "Registered fleet"],
    [BusFront, "Active Buses", stats.activeBuses || 0, "Available for operations"],
    [CalendarDays, "Today's Trips", stats.todayTrips || 0, "Scheduled departures"],
    [ClipboardCheck, "Reservations", stats.totalReservations || 0, "Active bookings"],
    [Users, "University Users", stats.totalUsers || 0, "Registered accounts", "/admin/users"],
    [Armchair, "Available Seats", stats.availableSeats || 0, "Across all buses"],
    [AlertTriangle, "Delayed Buses", stats.delayedBuses || 0, "Needs monitoring"],
    [Wrench, "Maintenance", stats.maintenanceBuses || 0, "Under maintenance"],
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Transport Authority"
          title="Transportation control center"
          description="Monitor university fleet operations, passenger demand, maintenance, and driver alerts from one workspace."
        />

        <DashboardBusCarousel />

        <FeaturedBusPhotosManager />

        {error && <ErrorState title="Control center unavailable" message={error} />}

        {!error && <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(([icon, label, value, helper, to]) => (
            to ? (
              <Link key={label} to={to} className="group block focus-ring rounded-2xl transition duration-200 hover:-translate-y-0.5">
                <StatCard icon={icon} label={label} value={value} helper={helper} />
              </Link>
            ) : (
              <StatCard key={label} icon={icon} label={label} value={value} helper={helper} />
            )
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-safar-ink">Recent reservations</h2><p className="text-sm text-safar-gray">Latest bookings across all user types.</p></div>
              <Link className="text-sm font-bold text-safar-teal hover:text-safar-navy" to="/admin/reservations">View all</Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {(overview?.reservations || []).slice(0, 5).map((reservation) => (
                <div key={reservation.bookingId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate font-semibold text-safar-ink">{reservation.passengerName}</p><p className="truncate text-xs text-safar-gray">{reservation.busName} | Seat {reservation.seatNumber} | {reservation.departureTime}</p></div>
                  <AdminStatusBadge status={reservation.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-safar-ink">Operational alerts</h2><p className="text-sm text-safar-gray">Condition and emergency reports.</p></div>
              <CircleAlert className="h-5 w-5 text-safar-amber" />
            </div>
            <div className="mt-4 space-y-3">
              {(overview?.alerts.conditions || []).slice(0, 2).map((alert) => (
                <div key={alert.id} className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
                  <p className="text-sm font-bold text-amber-800">{alert.condition}: {alert.category}</p>
                  <p className="mt-1 text-xs text-amber-700">{alert.description}</p>
                </div>
              ))}
              {(overview?.alerts.emergencies || []).slice(0, 2).map((alert) => (
                <div key={alert.id} className="rounded-xl bg-red-50 p-3 ring-1 ring-red-100">
                  <p className="text-sm font-bold text-red-800">Emergency: {alert.type}</p>
                  <p className="mt-1 text-xs text-red-700">{alert.currentLocation} | {alert.status}</p>
                </div>
              ))}
              {!overview?.alerts.conditions?.length && !overview?.alerts.emergencies?.length && (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">No new driver alerts.</div>
              )}
            </div>
          </div>
        </section></>}

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-safar-ink">Today's schedules</h2><Link className="text-sm font-bold text-safar-teal" to="/admin/schedules">Manage</Link></div>
            <div className="mt-4 divide-y divide-slate-100">
              {(overview?.schedules || []).slice(0, 5).map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between gap-3 py-3">
                  <div><p className="font-semibold text-safar-ink">{schedule.busName} | {schedule.departureTime}</p><p className="text-xs text-safar-gray">{schedule.route}</p></div>
                  <AdminStatusBadge status={schedule.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-safar-ink">Fleet overview</h2><Link className="text-sm font-bold text-safar-teal" to="/admin/fleet">Open fleet</Link></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(overview?.buses || []).slice(0, 6).map((bus) => (
                <div key={bus.id} className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-safar-ink">{bus.name}</p><p className="mt-1 text-xs text-safar-gray">{bus.currentLocation.label}</p><div className="mt-2"><AdminStatusBadge status={bus.status} /></div></div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
