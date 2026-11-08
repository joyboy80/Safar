import { AlertTriangle, BusFront, CirclePlay, Gauge, QrCode, Siren, UserCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import DashboardBusCarousel from "../../components/common/DashboardBusCarousel";
import ErrorState from "../../components/common/ErrorState";
import StatCard from "../../components/common/StatCard";
import TripStatusBadge from "../../components/driver/TripStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { notifyDriverTripUpdated } from "../../context/DriverLiveTrackingContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import { getCurrentTrip, getTripSummary, updateTripStatus } from "../../services/driverService";

const actions = [
  { label: "Passenger List", path: "/driver/passengers", icon: Users },
  { label: "QR Scanner", path: "/driver/scanner", icon: QrCode },
  { label: "Bus Condition", path: "/driver/bus-condition", icon: Gauge },
  { label: "Report Delay", path: "/driver/delay", icon: AlertTriangle },
  { label: "Emergency SOS", path: "/driver/emergency", icon: Siren, danger: true },
];

export default function DriverDashboard() {
  const { setToast, user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      const trip = await getCurrentTrip();
      setSummary(trip ? await getTripSummary(trip.id) : { trip: null, passengerCount: 0, boarded: 0, waiting: 0, capacity: 0 });
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function startTrip() {
    try {
      await updateTripStatus(summary.trip.id, "In Progress");
    } catch (requestError) {
      setToast({ type: "error", message: requestError.message });
      return;
    }
    notifyDriverTripUpdated();
    setToast({ type: "success", message: "Trip started. Live fleet is on — allow location access to share your bus position." });
    navigate("/driver/live-trip");
  }

  const trip = summary?.trip;
  const busName = trip?.busName || "Unassigned";
  const busNumber = trip?.busNumber || "—";
  const busCategory = trip?.busCategory || "No bus assigned";
  const capacity = summary?.capacity || trip?.capacity || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Driver Portal"
          title={`Welcome, ${user.name}`}
          description={`${user.universityId || user.id} | Assigned to ${busName} (${busNumber})`}
          actions={<Badge tone="success">Ready for duty</Badge>}
        />

        <DashboardBusCarousel />

        {error && <ErrorState title="Driver dashboard unavailable" message={error} />}

        {!error && <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={BusFront} label="Assigned Bus" value={busName} helper={busCategory} />
          <StatCard icon={Users} label="Passengers" value={`${summary?.passengerCount || 0} / ${capacity}`} helper="Current manifest" />
          <StatCard icon={UserCheck} label="Boarded" value={summary?.boarded || 0} helper="Verified passengers" />
          <StatCard icon={Users} label="Waiting" value={summary?.waiting || 0} helper="Not yet boarded" tone="text-safar-amber" />
        </section>

        {!trip && <section className="rounded-xl border-l-4 border-safar-teal bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="text-lg font-bold text-safar-ink">No bus has been assigned to you yet.</h2><p className="mt-1 text-sm text-safar-gray">Your assigned bus and trip details will appear here after Transport Admin assigns you a bus.</p></section>}

        {trip && (
          <section className="rounded-xl border-l-4 border-safar-teal bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-safar-teal">Today's Trip</p>
                  <TripStatusBadge status={trip.status} />
                </div>
                <h2 className="mt-2 text-xl font-bold text-safar-ink">{trip.route}</h2>
                <p className="mt-2 text-sm text-safar-gray">
                  {trip.departureTime} - {trip.arrivalTime} | {busCategory}
                </p>
              </div>
              <Button className="w-full lg:w-auto" icon={CirclePlay} disabled={trip.status === "In Progress"} onClick={startTrip}>
                {trip.status === "In Progress" ? "Trip In Progress" : "Start Trip"}
              </Button>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold text-safar-ink">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {actions.map((action) => (
              <Link
                key={action.label}
                className={`focus-ring flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl p-4 text-center text-sm font-extrabold shadow-sm ring-1 transition active:scale-[0.98] ${
                  action.danger
                    ? "bg-red-50 text-red-700 ring-red-100 hover:bg-red-100"
                    : "bg-white text-safar-ink ring-slate-200 hover:bg-safar-mint hover:text-safar-navy hover:ring-safar-teal/30"
                }`}
                to={action.path}
              >
                <span className={`grid h-12 w-12 place-items-center rounded-lg ${action.danger ? "bg-red-100" : "bg-safar-mint text-safar-teal"}`}><action.icon className="h-6 w-6" /></span>
                {action.label}
              </Link>
            ))}
          </div>
        </section></>}
      </div>
    </DashboardLayout>
  );
}
