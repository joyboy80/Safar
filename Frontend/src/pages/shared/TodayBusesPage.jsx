import {
  AlertCircle,
  BusFront,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Sparkles,
  Ticket,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Loading from "../../components/common/Loading";
import Modal from "../../components/common/Modal";
import PortalBusCard from "../../components/bus/PortalBusCard";
import PageHeader from "../../components/layout/PageHeader";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { getBusesByRole } from "../../services/busService";
import { cancelReservation, getReservations } from "../../services/reservationService";
import { canCancelReservation, getReservationState } from "../../utils/reservationRules";
import { formatDisplayDate, toDateInputValue } from "../../utils/date";

function formatFullDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function toneForReservationState(state) {
  if (state === "Upcoming" || state === "Active") return "success";
  if (state === "Cancelled") return "danger";
  if (state === "Completed") return "neutral";
  return "warning";
}

const reservationSubTabs = ["Upcoming", "Active", "Completed", "Cancelled"];

export default function TodayBusesPage({ role }) {
  const { user, setToast } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active portal tab: "buses" (Available Buses) or "reservations" (My Reservations)
  const currentTab = searchParams.get("tab") === "reservations" ? "reservations" : "buses";

  const todayIso = useMemo(() => toDateInputValue(), []);
  const initialDate = searchParams.get("date") || todayIso;

  // Selected date state
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [buses, setBuses] = useState([]);
  const [loadingBuses, setLoadingBuses] = useState(true);
  const [busError, setBusError] = useState("");

  // Reservations state (merged from Reservations portal)
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [activeReservationTab, setActiveReservationTab] = useState("Upcoming");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Load buses for selected date and role
  async function loadBuses() {
    setLoadingBuses(true);
    try {
      const data = await getBusesByRole(role, selectedDate);
      setBuses(data || []);
      setBusError("");
    } catch (requestError) {
      setBusError(requestError.message || "Failed to load buses.");
    } finally {
      setLoadingBuses(false);
    }
  }

  useEffect(() => {
    loadBuses();
  }, [role, selectedDate]);

  // Load user reservations
  async function loadReservations() {
    if (!user?.id) return;
    setLoadingReservations(true);
    try {
      const data = await getReservations(user.id);
      setReservations(data || []);
      setReservationError("");
    } catch (requestError) {
      setReservationError(requestError.message || "Failed to load reservations.");
    } finally {
      setLoadingReservations(false);
    }
  }

  useEffect(() => {
    loadReservations();
  }, [user?.id]);

  function handleTabChange(newTab) {
    const params = new URLSearchParams(searchParams);
    if (newTab === "reservations") {
      params.set("tab", "reservations");
    } else {
      params.delete("tab");
    }
    setSearchParams(params, { replace: true });
  }

  function handleDateChange(newDate) {
    if (!newDate) return;
    setSelectedDate(newDate);
    const params = new URLSearchParams(searchParams);
    if (newDate === todayIso) {
      params.delete("date");
    } else {
      params.set("date", newDate);
    }
    setSearchParams(params, { replace: true });
  }

  // Quick select pills for the next 7 days
  const quickDays = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(base.getDate() + i);
      const val = toDateInputValue(d);
      const dayLabel =
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
      const dateLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(d);
      list.push({ value: val, label: dayLabel, sub: dateLabel });
    }
    return list;
  }, []);

  // Filtered reservations for the current sub-tab
  const visibleReservations = useMemo(() => {
    return reservations.filter(
      (reservation) => getReservationState(reservation) === activeReservationTab
    );
  }, [activeReservationTab, reservations]);

  // Active reservations count for tab badge
  const activeReservationsCount = useMemo(() => {
    return reservations.filter((r) => {
      const state = getReservationState(r);
      return state === "Upcoming" || state === "Active";
    }).length;
  }, [reservations]);

  // Check if current user already has an active reservation on the selected date
  const userReservationOnSelectedDate = useMemo(() => {
    return reservations.find((r) => {
      const state = getReservationState(r);
      return r.date === selectedDate && (state === "Upcoming" || state === "Active");
    });
  }, [reservations, selectedDate]);

  async function handleConfirmCancel() {
    if (!cancelTarget || !user?.id) return;
    try {
      setCancelling(true);
      await cancelReservation(cancelTarget.bookingId, user.id);
      setCancelTarget(null);
      if (setToast) {
        setToast({
          type: "info",
          message: "Reservation cancelled and the seat is available again.",
        });
      }
      await Promise.all([loadReservations(), loadBuses()]);
    } catch (err) {
      if (setToast) {
        setToast({
          type: "danger",
          message: err.message || "Failed to cancel reservation.",
        });
      }
    } finally {
      setCancelling(false);
    }
  }

  const dateTone = useMemo(() => {
    if (selectedDate === todayIso) return "success";
    if (selectedDate > todayIso) return "info";
    return "warning";
  }, [selectedDate, todayIso]);

  const dateStatusLabel = useMemo(() => {
    if (selectedDate === todayIso) return "Today's Schedule";
    if (selectedDate > todayIso) return "Upcoming Schedule";
    return "Past Schedule";
  }, [selectedDate, todayIso]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Campus Transport"
          title={currentTab === "reservations" ? "My Bus Reservations" : "Available Buses"}
          description={
            currentTab === "reservations"
              ? "Review your upcoming, active, completed, and cancelled campus bus reservations."
              : "Pick a date to browse scheduled campus buses, check seat availability, and book tickets."
          }
          actions={
            <div className="flex items-center gap-2">
              <Badge tone={dateTone}>{dateStatusLabel}</Badge>
            </div>
          }
        />

        {/* ========================================================================= */}
        {/* UNIFIED PORTAL NAVIGATION TABS                                            */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <button
            type="button"
            className={`focus-ring inline-flex min-h-11 items-center gap-2.5 rounded-xl px-5 text-sm font-bold transition-all duration-200 ${
              currentTab === "buses"
                ? "bg-safar-teal text-white shadow-sm"
                : "bg-white text-safar-gray hover:bg-slate-100 hover:text-safar-ink dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("buses")}
          >
            <BusFront className="h-4 w-4" />
            <span>Available Buses</span>
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                currentTab === "buses"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {buses.length}
            </span>
          </button>

          <button
            type="button"
            className={`focus-ring inline-flex min-h-11 items-center gap-2.5 rounded-xl px-5 text-sm font-bold transition-all duration-200 ${
              currentTab === "reservations"
                ? "bg-safar-teal text-white shadow-sm"
                : "bg-white text-safar-gray hover:bg-slate-100 hover:text-safar-ink dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("reservations")}
          >
            <Ticket className="h-4 w-4" />
            <span>My Reservations</span>
            {activeReservationsCount > 0 && (
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  currentTab === "reservations"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {activeReservationsCount} active
              </span>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: AVAILABLE BUSES (DATE SELECTOR ONLY - NO OLD SEARCH/FILTERS)       */}
        {/* ========================================================================= */}
        {currentTab === "buses" && (
          <div className="space-y-6">
            {/* DATE SELECTOR CARD */}
            <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Left: Date indicator & title */}
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-brand-maroon/15 to-brand-purple/15 text-brand-purple ring-1 ring-brand-purple/20 dark:from-brand-maroon/30 dark:to-brand-purple/30 dark:text-purple-300">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-safar-ink dark:text-white">
                        {formatFullDate(selectedDate)}
                      </h2>
                      {selectedDate === todayIso && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800">
                          <Sparkles className="h-3 w-3" /> Today
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-safar-gray dark:text-slate-400">
                      {loadingBuses
                        ? "Checking scheduled departures..."
                        : `${buses.length} ${buses.length === 1 ? "bus" : "buses"} scheduled for your role`}
                    </p>
                  </div>
                </div>

                {/* Right: Date Picker control & Refresh */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      aria-label="Pick travel date"
                      className="focus-ring h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-safar-ink shadow-sm transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>

                  {selectedDate !== todayIso && (
                    <Button
                      variant="secondary"
                      onClick={() => handleDateChange(todayIso)}
                      className="text-xs font-semibold"
                    >
                      Reset to Today
                    </Button>
                  )}

                  <button
                    type="button"
                    title="Refresh schedule"
                    className="focus-ring grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-safar-gray shadow-sm transition hover:bg-slate-50 hover:text-safar-ink dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    onClick={loadBuses}
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingBuses ? "animate-spin text-safar-teal" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Quick Select Day Pills */}
              <div className="mt-4 flex gap-2 overflow-x-auto pt-2">
                {quickDays.map((day) => {
                  const isSelected = selectedDate === day.value;
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`focus-ring flex shrink-0 flex-col items-center justify-center rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-gradient-to-r from-brand-maroon to-brand-purple text-white shadow-md shadow-brand-purple/20"
                          : "border border-slate-200/80 bg-white/50 text-safar-gray hover:bg-white hover:text-safar-ink dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => handleDateChange(day.value)}
                    >
                      <span className="font-bold">{day.label}</span>
                      <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                        {day.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Active reservation banner on selected date */}
            {userReservationOnSelectedDate && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800 dark:bg-emerald-950/40">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      You have a confirmed reservation on this date
                    </h3>
                    <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      {userReservationOnSelectedDate.busName} • Seat {userReservationOnSelectedDate.seatNumber} • {userReservationOnSelectedDate.departureTime} ({userReservationOnSelectedDate.route})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/${role}/tickets/${userReservationOnSelectedDate.ticketId}`}
                    className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Ticket
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleTabChange("reservations")}
                    className="focus-ring inline-flex min-h-9 items-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300"
                  >
                    Manage Reservation
                  </button>
                </div>
              </div>
            )}

            {/* BUSES LIST SECTION */}
            {loadingBuses ? (
              <Loading message={`Loading buses for ${formatDisplayDate(selectedDate)}...`} />
            ) : busError ? (
              <ErrorState title="Unable to load buses" message={busError} retry={loadBuses} />
            ) : buses.length > 0 ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {buses.map((bus) => (
                  <PortalBusCard
                    key={bus.scheduleId || bus.tripId || bus.id}
                    bus={bus}
                    role={role}
                    date={selectedDate}
                  />
                ))}
              </section>
            ) : (
              <EmptyState
                title={`No buses available on ${formatDisplayDate(selectedDate)}`}
                message={`There are currently no bus departures scheduled for ${formatFullDate(selectedDate)}. Please choose another date or reset to today.`}
                action={
                  selectedDate !== todayIso ? (
                    <Button onClick={() => handleDateChange(todayIso)}>
                      View Today's Buses
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY RESERVATIONS (MERGED PORTAL)                                    */}
        {/* ========================================================================= */}
        {currentTab === "reservations" && (
          <div className="space-y-6">
            {reservationError && (
              <ErrorState title="Reservations unavailable" message={reservationError} retry={loadReservations} />
            )}

            {/* Sub-tabs for reservation status */}
            <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              {reservationSubTabs.map((tab) => {
                const count = reservations.filter(
                  (r) => getReservationState(r) === tab
                ).length;
                return (
                  <button
                    key={tab}
                    className={`focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                      activeReservationTab === tab
                        ? "bg-safar-teal text-white shadow-sm"
                        : "text-safar-gray hover:bg-slate-100 hover:text-safar-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                    onClick={() => setActiveReservationTab(tab)}
                    type="button"
                  >
                    <span>{tab}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        activeReservationTab === tab
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Reservations Cards List */}
            {loadingReservations ? (
              <Loading message="Loading your reservations..." />
            ) : (
              <section className="space-y-3">
                {visibleReservations.map((reservation) => {
                  const state = getReservationState(reservation);
                  const cancellable = canCancelReservation(reservation);

                  return (
                    <article
                      key={reservation.bookingId}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-safar-ink dark:text-white">
                              {reservation.busName}
                            </h3>
                            <Badge tone={toneForReservationState(state)}>{state}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-safar-gray dark:text-slate-400">
                            {reservation.route}
                          </p>
                          <div className="mt-3 grid gap-2 text-sm text-safar-gray sm:grid-cols-2 lg:grid-cols-4 dark:text-slate-300">
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="h-4 w-4 text-safar-teal" />
                              {formatDisplayDate(reservation.date)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-safar-teal" />
                              {reservation.departureTime} - {reservation.arrivalTime}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Ticket className="h-4 w-4 text-safar-teal" />
                              Seat {reservation.seatNumber}
                            </span>
                            <span className="truncate text-xs text-slate-400">
                              ID: {reservation.bookingId}
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-72">
                          <Link
                            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-safar-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:hover:bg-slate-700"
                            to={`/${role}/tickets/${reservation.ticketId}`}
                          >
                            <Eye className="h-4 w-4" />
                            View Ticket
                          </Link>
                          <Button
                            variant="danger"
                            icon={XCircle}
                            disabled={!cancellable}
                            onClick={() => setCancelTarget(reservation)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {visibleReservations.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-safar-gray shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    <p>No {activeReservationTab.toLowerCase()} reservations found.</p>
                    {activeReservationTab === "Upcoming" && (
                      <div className="mt-4">
                        <Button onClick={() => handleTabChange("buses")}>
                          Browse Available Buses
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        title="Cancel this reservation?"
        description={
          cancelTarget
            ? `Are you sure you want to cancel your seat (${cancelTarget.seatNumber}) on ${cancelTarget.busName} for ${formatDisplayDate(cancelTarget.date)}? The seat will immediately become available for other passengers.`
            : "Are you sure you want to cancel this reservation?"
        }
        confirmLabel={cancelling ? "Cancelling..." : "Cancel Reservation"}
        danger
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />
    </DashboardLayout>
  );
}
