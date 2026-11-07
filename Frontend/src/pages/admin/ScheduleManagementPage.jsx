import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Edit2,
  Filter,
  MapPin,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminFormModal from "../../components/admin/AdminFormModal";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Loading from "../../components/common/Loading";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  cancelSchedule,
  deleteSchedule,
  getAdminBuses,
  getAdminDrivers,
  getAdminRoutes,
  getAdminSchedules,
  saveSchedule,
} from "../../services/adminService";
import { toDateInputValue } from "../../utils/date";

const OUTBOUND_TIMES = ["05:45 AM", "01:30 PM", "02:30 PM", "04:15 PM"];
const INBOUND_TIMES = ["07:10 AM", "02:20 PM", "07:00 PM", "08:15 PM", "08:45 PM"];

const scheduleStatusBadges = {
  Scheduled: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  Running: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 animate-pulse",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

const blankSchedule = () => ({
  id: "",
  busId: "",
  driverId: "",
  routeId: "",
  departureTime: "",
  customTime: "",
  scheduleDate: toDateInputValue(),
  scheduleStatus: "Scheduled",
});

export default function ScheduleManagementPage() {
  const { setToast } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [dateFilter, setDateFilter] = useState(toDateInputValue());
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [schedulesData, busesData, routesData, driversData] = await Promise.all([
        getAdminSchedules({ date: dateFilter || undefined, status: statusFilter }),
        getAdminBuses(),
        getAdminRoutes(),
        getAdminDrivers(),
      ]);

      setSchedules(schedulesData || []);
      setBuses(busesData || []);
      setRoutes(routesData || []);
      setDrivers(driversData || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load schedules and fleet data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [dateFilter, statusFilter]);

  // Registered Online Buses available for scheduling
  const availableBuses = useMemo(() => {
    return buses.filter((b) => {
      const st = b.operationalStatus || b.status;
      return st === "Online";
    });
  }, [buses]);

  // Verified active drivers
  const verifiedDrivers = useMemo(() => {
    return drivers.filter((d) => d.isActive !== false && d.isVerified !== false);
  }, [drivers]);

  // Selected bus in modal
  const selectedBus = useMemo(() => {
    if (!form?.busId) return null;
    return buses.find((b) => b.id === form.busId) || null;
  }, [buses, form?.busId]);

  // Selected driver in modal
  const selectedDriver = useMemo(() => {
    if (!form?.driverId) return null;
    return drivers.find((d) => d.id === form.driverId || d.authUserId === form.driverId) || null;
  }, [drivers, form?.driverId]);

  // Selected route in modal
  const selectedRoute = useMemo(() => {
    if (!form?.routeId) return null;
    return routes.find((r) => r.id === form.routeId) || null;
  }, [routes, form?.routeId]);

  // Dynamic route departure times
  const availableDepartureTimes = useMemo(() => {
    if (!selectedRoute) return OUTBOUND_TIMES;
    const dir = (selectedRoute.direction || selectedRoute.start || "").toLowerCase();
    if (dir.includes("station") && !dir.includes("cuet")) {
      return INBOUND_TIMES;
    }
    return OUTBOUND_TIMES;
  }, [selectedRoute]);

  const visibleSchedules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return schedules.filter((s) => {
      if (statusFilter !== "All" && s.scheduleStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.busName || "").toLowerCase().includes(q) ||
        (s.registrationNumber || "").toLowerCase().includes(q) ||
        (s.driverName || "").toLowerCase().includes(q) ||
        (s.routeName || "").toLowerCase().includes(q) ||
        (s.id || "").toLowerCase().includes(q)
      );
    });
  }, [schedules, searchQuery, statusFilter]);

  function handleOpenCreate() {
    const defaultRoute = routes[0]?.id || "";
    setForm({
      ...blankSchedule(),
      routeId: defaultRoute,
      departureTime: OUTBOUND_TIMES[0],
    });
  }

  function handleOpenEdit(schedule) {
    const times = OUTBOUND_TIMES.includes(schedule.departureTime) || INBOUND_TIMES.includes(schedule.departureTime);
    setForm({
      id: schedule.id,
      busId: schedule.busId,
      driverId: schedule.driverId,
      routeId: schedule.routeId,
      departureTime: times ? schedule.departureTime : "custom",
      customTime: times ? "" : schedule.departureTime,
      scheduleDate: schedule.scheduleDate,
      scheduleStatus: schedule.scheduleStatus,
    });
  }

  async function handleSaveSchedule(e) {
    e.preventDefault();
    if (!form.busId) {
      setToast({ type: "error", message: "Please select a registered bus." });
      return;
    }
    if (!form.driverId) {
      setToast({ type: "error", message: "Please select an assigned driver." });
      return;
    }
    if (!form.routeId) {
      setToast({ type: "error", message: "Please select a bus route." });
      return;
    }

    const finalTime = form.departureTime === "custom" ? form.customTime.trim() : form.departureTime;
    if (!finalTime) {
      setToast({ type: "error", message: "Please select or provide a departure time." });
      return;
    }

    if (!form.scheduleDate) {
      setToast({ type: "error", message: "Please select a valid schedule date." });
      return;
    }

    const today = toDateInputValue();
    if (form.scheduleDate < today) {
      setToast({ type: "error", message: "Schedules cannot be set for past dates." });
      return;
    }

    setSaving(true);
    try {
      await saveSchedule({
        id: form.id || undefined,
        busId: form.busId,
        driverId: form.driverId,
        routeId: form.routeId,
        departureTime: finalTime,
        scheduleDate: form.scheduleDate,
        scheduleStatus: form.scheduleStatus || "Scheduled",
      });

      setToast({
        type: "success",
        message: form.id ? "Schedule updated successfully." : "Schedule published successfully.",
      });
      setForm(null);
      await loadData();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to save schedule." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    try {
      await cancelSchedule(cancelTarget.id);
      setToast({ type: "success", message: `Schedule ${cancelTarget.id} marked as Cancelled.` });
      setCancelTarget(null);
      await loadData();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Could not cancel schedule." });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteSchedule(deleteTarget.id);
      setToast({ type: "success", message: `Schedule ${deleteTarget.id} deleted.` });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Could not delete schedule." });
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Transport Admin"
          title="Integrated Bus Scheduling System"
          description="Schedule registered buses to verified drivers along predefined campus routes with real-time tracking integration."
          actions={
            <Button onClick={handleOpenCreate} icon={Plus}>
              Create Schedule
            </Button>
          }
        />

        {/* Filters and Date Bar */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
            <div className="relative mt-1">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Search</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by bus, driver, or route name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs font-semibold text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Schedule List */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Loading label="Loading bus schedules..." />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : visibleSchedules.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No schedules found"
            description={
              searchQuery || statusFilter !== "All"
                ? "No schedules match your current filters. Try selecting a different date or clearing filters."
                : `No bus trips scheduled for ${dateFilter || "this date"}. Click 'Create Schedule' to assign a trip.`
            }
            action={
              <Button onClick={handleOpenCreate} icon={Plus}>
                Create First Schedule
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visibleSchedules.map((schedule) => {
              const badgeClass = scheduleStatusBadges[schedule.scheduleStatus] || scheduleStatusBadges.Scheduled;

              return (
                <div
                  key={schedule.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-teal-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    {/* Top Row: Schedule ID, Date & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg dark:bg-slate-800 dark:text-slate-300">
                          {schedule.id}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {schedule.scheduleDate}
                        </span>
                      </div>

                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                        {schedule.scheduleStatus}
                      </span>
                    </div>

                    {/* Bus & Driver Details */}
                    <div className="mt-3.5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bus & Category</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                          {schedule.busName}
                        </p>
                        <p className="font-mono text-xs text-teal-600 dark:text-teal-400">
                          {schedule.registrationNumber} • {schedule.busCategory}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Driver</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{schedule.driverName || "Driver Unassigned"}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Capacity: {schedule.capacity} seats
                        </p>
                      </div>
                    </div>

                    {/* Route & Departure Timing */}
                    <div className="mt-3.5 flex items-start gap-3">
                      <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 shrink-0">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black text-slate-900 dark:text-white">
                            Departure: {schedule.departureTime}
                          </p>
                          <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                            {schedule.routeDirection || "Campus Route"}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {schedule.routeName}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      Bus Status: <strong className="text-slate-700 dark:text-slate-300">{schedule.currentBusStatus || "Online"}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      {schedule.scheduleStatus !== "Cancelled" && schedule.scheduleStatus !== "Completed" && (
                        <button
                          onClick={() => setCancelTarget(schedule)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          Cancel Trip
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(schedule)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors dark:text-slate-400 dark:hover:bg-slate-800"
                        title="Edit Schedule"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setDeleteTarget(schedule)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors dark:text-rose-400 dark:hover:bg-rose-950/40"
                        title="Delete Schedule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Schedule Modal */}
      {form && (
        <AdminFormModal
          isOpen={true}
          onClose={() => !saving && setForm(null)}
          title={form.id ? `Edit Schedule: ${form.id}` : "Create Bus Schedule"}
          subtitle="Assign registered bus, driver, route, and official departure time"
        >
          <form onSubmit={handleSaveSchedule} className="space-y-4">
            {/* 1. Bus Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                1. Select Registered Bus <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.busId}
                onChange={(e) => setForm({ ...form, busId: e.target.value })}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">-- Choose an Online Bus --</option>
                {buses.map((bus) => {
                  const st = bus.operationalStatus || bus.status;
                  const isAvailable = st === "Online" || bus.id === form.busId;
                  return (
                    <option
                      key={bus.id}
                      value={bus.id}
                      disabled={!isAvailable}
                      className={!isAvailable ? "text-slate-400 bg-slate-100" : ""}
                    >
                      {bus.name || bus.busName} ({bus.number || bus.registrationNumber}) — {bus.category} [{st}]
                    </option>
                  );
                })}
              </select>
              {selectedBus && (
                <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                  <span>Category: <strong className="text-slate-800 dark:text-slate-200">{selectedBus.category}</strong></span>
                  <span>Capacity: <strong className="text-slate-800 dark:text-slate-200">{selectedBus.capacity} seats</strong></span>
                </div>
              )}
            </div>

            {/* 2. Driver Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                2. Select Assigned Driver <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.driverId}
                onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">-- Choose a Verified Driver --</option>
                {verifiedDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.fullName || driver.name} ({driver.email || driver.phone || "Driver"})
                  </option>
                ))}
              </select>
              {selectedDriver && (
                <p className="mt-1 text-xs text-slate-500">
                  Assigned driver: <strong>{selectedDriver.fullName || selectedDriver.name}</strong>
                </p>
              )}
            </div>

            {/* 3. Route Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                3. Select Campus Route <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.routeId}
                onChange={(e) => {
                  const newRouteId = e.target.value;
                  const newRoute = routes.find((r) => r.id === newRouteId);
                  const isStation = (newRoute?.direction || newRoute?.start || "").toLowerCase().includes("station");
                  const defaultTime = isStation ? INBOUND_TIMES[0] : OUTBOUND_TIMES[0];
                  setForm({
                    ...form,
                    routeId: newRouteId,
                    departureTime: defaultTime,
                  });
                }}
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">-- Choose an Existing Route --</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name} ({route.direction || `${route.start} → ${route.destination}`})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Departure Time & Schedule Date */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  4. Departure Time <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.departureTime}
                  onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {availableDepartureTimes.map((t) => (
                    <option key={t} value={t}>
                      {t} (Official Timing)
                    </option>
                  ))}
                  <option value="custom">-- Custom Departure Time --</option>
                </select>

                {form.departureTime === "custom" && (
                  <input
                    type="text"
                    value={form.customTime}
                    onChange={(e) => setForm({ ...form, customTime: e.target.value })}
                    placeholder="e.g. 09:30 AM"
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  5. Schedule Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  min={toDateInputValue()}
                  value={form.scheduleDate}
                  onChange={(e) => setForm({ ...form, scheduleDate: e.target.value })}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Review Summary Card */}
            {selectedBus && selectedRoute && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 text-xs dark:border-teal-900/50 dark:bg-teal-950/20">
                <p className="font-bold text-teal-800 dark:text-teal-200">Trip Review Summary</p>
                <div className="mt-1.5 space-y-1 text-teal-700 dark:text-teal-300">
                  <p>• <strong>Bus:</strong> {selectedBus.name || selectedBus.busName} ({selectedBus.number || selectedBus.registrationNumber})</p>
                  <p>• <strong>Driver:</strong> {selectedDriver?.fullName || selectedDriver?.name || "Selected Driver"}</p>
                  <p>• <strong>Route:</strong> {selectedRoute.name}</p>
                  <p>• <strong>Timing & Date:</strong> {form.departureTime === "custom" ? form.customTime : form.departureTime} on {form.scheduleDate}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {form.id ? "Update Schedule" : "Publish Schedule"}
              </Button>
            </div>
          </form>
        </AdminFormModal>
      )}

      {/* Cancel Schedule Modal */}
      {cancelTarget && (
        <Modal
          isOpen={true}
          onClose={() => setCancelTarget(null)}
          title="Cancel Bus Schedule"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to cancel schedule <strong>{cancelTarget.id}</strong> (
              {cancelTarget.busName} — {cancelTarget.departureTime})?
            </p>
            <p className="text-xs text-slate-500">
              This will notify passengers and release the bus and driver from this time slot.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)}>
                Keep Schedule
              </Button>
              <Button variant="danger" onClick={handleCancelConfirm}>
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Schedule Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Bus Schedule"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete schedule <strong>{deleteTarget.id}</strong>?
              This will completely remove the schedule from the database.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
