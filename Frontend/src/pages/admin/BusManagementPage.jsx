import {
  AlertCircle,
  Bus as BusIcon,
  CheckCircle2,
  Clock,
  Edit2,
  Image as ImageIcon,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminFormModal from "../../components/admin/AdminFormModal";
import FeaturedBusPhotosManager from "../../components/admin/FeaturedBusPhotosManager";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Loading from "../../components/common/Loading";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  deleteBus,
  getAdminBuses,
  saveBus,
  updateBusStatus,
} from "../../services/adminService";

const OPERATIONAL_STATUSES = ["Online", "Running", "Stopped", "Maintenance"];

const BUS_CATEGORIES = [
  "AC",
  "Non-AC",
  "University Shuttle",
  "Student Bus",
  "Female Student Bus",
  "Teacher Bus",
  "Staff Bus",
];

const statusStyles = {
  Online: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  Running: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  Stopped: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  Maintenance: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

const blankBus = () => ({
  id: "",
  busName: "",
  registrationNumber: "",
  category: "University Shuttle",
  capacity: 40,
  description: "",
  imageUrl: "",
  operationalStatus: "Online",
});

export default function BusManagementPage() {
  const { setToast } = useAuth();
  const [buses, setBuses] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadFleet() {
    setLoading(true);
    try {
      const data = await getAdminBuses();
      setBuses(data || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load bus fleet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFleet();
  }, []);

  const stats = useMemo(() => {
    const total = buses.length;
    const online = buses.filter((b) => (b.operationalStatus || b.status) === "Online").length;
    const running = buses.filter((b) => (b.operationalStatus || b.status) === "Running").length;
    const stopped = buses.filter((b) => (b.operationalStatus || b.status) === "Stopped").length;
    const maintenance = buses.filter((b) => (b.operationalStatus || b.status) === "Maintenance").length;
    return { total, online, running, stopped, maintenance };
  }, [buses]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buses.filter((b) => {
      const currentStatus = b.operationalStatus || b.status || "Online";
      if (statusFilter !== "All" && currentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        (b.name || b.busName || "").toLowerCase().includes(q) ||
        (b.number || b.registrationNumber || "").toLowerCase().includes(q) ||
        (b.category || "").toLowerCase().includes(q) ||
        (b.id || "").toLowerCase().includes(q)
      );
    });
  }, [buses, query, statusFilter]);

  function handleOpenCreate() {
    setForm(blankBus());
  }

  function handleOpenEdit(bus) {
    setForm({
      id: bus.id,
      busName: bus.name || bus.busName || "",
      registrationNumber: bus.number || bus.registrationNumber || "",
      category: bus.category || "University Shuttle",
      capacity: bus.capacity || 40,
      description: bus.description || "",
      imageUrl: bus.imageUrl || "",
      operationalStatus: bus.operationalStatus || bus.status || "Online",
    });
  }

  async function handleQuickStatusChange(busId, newStatus) {
    try {
      await updateBusStatus(busId, newStatus);
      setToast({ type: "success", message: `Bus status updated to ${newStatus}.` });
      setBuses((prev) =>
        prev.map((b) => (b.id === busId ? { ...b, operationalStatus: newStatus, status: newStatus } : b))
      );
    } catch (err) {
      setToast({ type: "error", message: err.message || "Could not update status." });
    }
  }

  async function handleSaveBus(e) {
    e.preventDefault();
    if (!form.busName.trim()) {
      setToast({ type: "error", message: "Bus Name is required." });
      return;
    }
    if (!form.registrationNumber.trim()) {
      setToast({ type: "error", message: "Registration Number is required." });
      return;
    }
    if (!form.capacity || Number(form.capacity) < 1 || Number(form.capacity) > 120) {
      setToast({ type: "error", message: "Capacity must be between 1 and 120." });
      return;
    }

    setSaving(true);
    try {
      await saveBus({
        id: form.id || undefined,
        name: form.busName.trim(),
        registrationNumber: form.registrationNumber.trim(),
        category: form.category,
        capacity: Number(form.capacity),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        operationalStatus: form.operationalStatus,
      });

      setToast({
        type: "success",
        message: form.id ? "Bus details updated successfully." : "New bus registered successfully.",
      });
      setForm(null);
      await loadFleet();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to save bus record." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteBus(deleteTarget.id);
      setToast({ type: "success", message: `Bus ${deleteTarget.name || deleteTarget.busName} deleted.` });
      setDeleteTarget(null);
      await loadFleet();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Could not delete bus." });
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Transport Admin"
          title="Bus Fleet Management"
          description="Register, monitor, and configure all university buses and their operational statuses."
          actions={
            <Button onClick={handleOpenCreate} icon={Plus}>
              Add Bus
            </Button>
          }
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Fleet</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Online</p>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-1 text-2xl font-black text-emerald-800 dark:text-emerald-200">{stats.online}</p>
          </div>
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Running</p>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <p className="mt-1 text-2xl font-black text-blue-800 dark:text-blue-200">{stats.running}</p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Stopped</p>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-200">{stats.stopped}</p>
          </div>
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Maintenance</p>
              <Wrench className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <p className="mt-1 text-2xl font-black text-rose-800 dark:text-rose-200">{stats.maintenance}</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by bus name, reg number, or ID..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition-all focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-all focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="All">All Statuses ({stats.total})</option>
              <option value="Online">Online ({stats.online})</option>
              <option value="Running">Running ({stats.running})</option>
              <option value="Stopped">Stopped ({stats.stopped})</option>
              <option value="Maintenance">Maintenance ({stats.maintenance})</option>
            </select>
          </div>
        </div>

        {/* Fleet List / Cards */}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Loading label="Loading bus fleet..." />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={loadFleet} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BusIcon}
            title="No buses found"
            description={
              query || statusFilter !== "All"
                ? "No buses match your current filters. Try clearing search or status filters."
                : "No buses have been registered in the fleet yet."
            }
            action={
              <Button onClick={handleOpenCreate} icon={Plus}>
                Register First Bus
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((bus) => {
              const currentStatus = bus.operationalStatus || bus.status || "Online";
              const isBusy = currentStatus === "Running";

              return (
                <div
                  key={bus.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-teal-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    {/* Top row: ID badge & Operational Status Dropdown */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg dark:bg-slate-800 dark:text-slate-400">
                          {bus.id}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                          {bus.category || "Standard"}
                        </span>
                      </div>

                      <div className="relative">
                        <select
                          value={currentStatus}
                          onChange={(e) => handleQuickStatusChange(bus.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border appearance-none pr-6 cursor-pointer focus:outline-none transition-all ${
                            statusStyles[currentStatus] || statusStyles.Online
                          }`}
                        >
                          {OPERATIONAL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-70">
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* Bus Name & Registration Number */}
                    <div className="mt-3">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight dark:text-white">
                        {bus.name || bus.busName}
                      </h3>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                        Reg: {bus.number || bus.registrationNumber}
                      </p>
                    </div>

                    {/* Capacity & Description */}
                    <div className="mt-4 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-slate-400">Capacity:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{bus.capacity} seats</span>
                      </div>
                      {bus.imageUrl && (
                        <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>Photo</span>
                        </div>
                      )}
                    </div>

                    {bus.description && (
                      <p className="mt-2.5 text-xs text-slate-500 line-clamp-2 dark:text-slate-400">
                        {bus.description}
                      </p>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      {isBusy ? "⚡ Operating on trip" : "Ready for assignment"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(bus)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Edit Bus Details"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(bus)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors dark:text-rose-400 dark:hover:bg-rose-950/40"
                        title="Delete Bus"
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

        {/* Featured Photos Manager */}
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800">
          <FeaturedBusPhotosManager />
        </div>
      </div>

      {/* Add / Edit Bus Modal */}
      {form && (
        <AdminFormModal
          open={Boolean(form)}
          isOpen={true}
          onClose={() => !saving && setForm(null)}
          title={form.id ? `Edit Bus: ${form.busName}` : "Add New Bus"}
          subtitle="Configure registered fleet vehicle properties and status"
        >
          <form onSubmit={handleSaveBus} className="space-y-4">
            {form.id && (
              <div>
                <label className="text-xs font-semibold text-slate-500">Bus ID</label>
                <input
                  type="text"
                  value={form.id}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bus Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.busName}
                  onChange={(e) => setForm({ ...form, busName: e.target.value })}
                  placeholder="e.g. Padma, Karnafuli-1"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Registration Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  placeholder="e.g. CTG-METRO-11-2233"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {BUS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Capacity (Seats) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Operational Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.operationalStatus}
                  onChange={(e) => setForm({ ...form, operationalStatus: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {OPERATIONAL_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Image URL (Optional)
              </label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Air-conditioned campus express coach with WiFi..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {form.id ? "Update Bus" : "Register Bus"}
              </Button>
            </div>
          </form>
        </AdminFormModal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete Bus Record"
        >
          <div className="space-y-4">
            {(deleteTarget.operationalStatus === "Running" || deleteTarget.status === "Running") && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <div>
                  <p className="font-bold">Active Running Trip Warning</p>
                  <p className="mt-0.5">
                    This bus is marked as <strong>Running</strong>. Deleting it will terminate and cancel its active trip.
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete bus{" "}
              <strong>{deleteTarget.name || deleteTarget.busName}</strong> (
              <span className="font-mono">{deleteTarget.number || deleteTarget.registrationNumber}</span>)?
              This action cannot be undone.
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
