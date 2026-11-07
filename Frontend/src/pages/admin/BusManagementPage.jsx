import { Eye, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminFormModal from "../../components/admin/AdminFormModal";
import AdminStatusBadge from "../../components/admin/AdminStatusBadge";
import FeaturedBusPhotosManager from "../../components/admin/FeaturedBusPhotosManager";
import ResponsiveDataList from "../../components/admin/ResponsiveDataList";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Loading from "../../components/common/Loading";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import PageHeader from "../../components/layout/PageHeader";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout";
import { deleteBus, getAdminBuses, getAdminRoutes, saveBus } from "../../services/adminService";

const blankBusForm = {
  busId: "",
  id: "",
  routeId: "",
  type: "Student Bus",
  capacity: 44,
  status: "On Time",
};

export default function BusManagementPage() {
  const { setToast } = useAuth();
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [busData, routeData] = await Promise.all([getAdminBuses(), getAdminRoutes()]);
      setBuses(busData);
      setRoutes(routeData);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.toLowerCase();
    return buses.filter((bus) =>
      [bus.name, bus.number, bus.type, bus.route, bus.assignedDriver].some((value) =>
        value?.toLowerCase().includes(needle)
      )
    );
  }, [buses, query]);

  function handleOpenModal(bus = null) {
    if (bus) {
      const matchedRoute = routes.find(
        (r) =>
          r.id === bus.routeId ||
          r.name === bus.route ||
          `${r.start} - ${r.destination}` === bus.route ||
          `${r.start} to ${r.destination}` === bus.route
      );
      setForm({
        busId: bus.id,
        id: bus.id,
        routeId: bus.routeId || matchedRoute?.id || "",
        type: bus.type || "Student Bus",
        capacity: bus.capacity || 44,
        status: bus.status || "On Time",
      });
    } else {
      setForm({ ...blankBusForm });
    }
  }

  function handleBusSelect(busId) {
    const selected = buses.find((b) => b.id === busId);
    if (!selected) {
      setForm((prev) => ({ ...prev, busId }));
      return;
    }
    const matchedRoute = routes.find(
      (r) =>
        r.id === selected.routeId ||
        r.name === selected.route ||
        `${r.start} - ${r.destination}` === selected.route ||
        `${r.start} to ${r.destination}` === selected.route
    );
    setForm((prev) => ({
      ...prev,
      busId: selected.id,
      id: selected.id,
      type: selected.type || prev.type,
      capacity: selected.capacity || prev.capacity,
      status: selected.status || prev.status,
      routeId: selected.routeId || matchedRoute?.id || prev.routeId || "",
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.busId) {
      setToast({ type: "error", message: "Please select a bus from the database." });
      return;
    }
    if (!form.routeId) {
      setToast({ type: "error", message: "Please select a route from the database." });
      return;
    }

    setSaving(true);
    try {
      await saveBus({
        busId: form.busId,
        id: form.busId,
        routeId: form.routeId,
        type: form.type,
        capacity: Number(form.capacity),
        status: form.status,
      });
      setToast({
        type: "success",
        message: "Bus and route configuration updated successfully.",
      });
      setForm(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setToast({ type: "error", message: requestError.message });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await deleteBus(deleteTarget.id);
      setDeleteTarget(null);
      setToast({ type: "info", message: "Bus removed from the admin fleet list." });
      await load();
    } catch (requestError) {
      setError(requestError.message);
      setToast({ type: "error", message: requestError.message });
      setDeleteTarget(null);
    }
  }

  const selectedBus = useMemo(
    () => buses.find((b) => b.id === form?.busId),
    [buses, form?.busId]
  );

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === form?.routeId),
    [routes, form?.routeId]
  );

  const actions = (bus) => (
    <div className="flex flex-wrap gap-2">
      <button
        className="focus-ring rounded-lg p-2 text-safar-teal hover:bg-safar-mint hover:text-safar-navy"
        aria-label={`Edit ${bus.name}`}
        onClick={() => handleOpenModal(bus)}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        className="focus-ring rounded-lg p-2 text-safar-gray hover:bg-slate-100 hover:text-safar-ink"
        aria-label={`View condition for ${bus.name}`}
        onClick={() =>
          setToast({
            type: "info",
            message: `${bus.name}: ${bus.status}, ${bus.availableSeats ?? bus.capacity} seats available.`,
          })
        }
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        className="focus-ring rounded-lg p-2 text-safar-gray hover:bg-slate-100 hover:text-safar-ink"
        aria-label={`View location for ${bus.name}`}
        onClick={() =>
          setToast({
            type: "info",
            message: bus.currentLocation?.label
              ? `${bus.name} is at ${bus.currentLocation.label}.`
              : "No backend-reported location is available.",
          })
        }
      >
        <MapPin className="h-4 w-4" />
      </button>
      <button
        className="focus-ring rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700"
        aria-label={`Delete ${bus.name}`}
        onClick={() => setDeleteTarget(bus)}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const columns = [
    {
      label: "Bus",
      render: (bus) => (
        <div>
          <p className="font-bold text-safar-ink">{bus.name}</p>
          <p className="text-xs text-safar-gray">
            {bus.id} | {bus.number}
          </p>
        </div>
      ),
    },
    {
      label: "Category",
      render: (bus) => <span className="font-medium text-safar-gray">{bus.type}</span>,
    },
    {
      label: "Capacity",
      render: (bus) => <span className="font-bold text-safar-ink">{bus.capacity}</span>,
    },
    {
      label: "Route",
      render: (bus) => <span className="text-safar-gray">{bus.route}</span>,
    },
    {
      label: "Driver",
      render: (bus) => <span className="text-safar-gray">{bus.assignedDriver || "Unassigned"}</span>,
    },
    {
      label: "Status",
      render: (bus) => <AdminStatusBadge status={bus.status} />,
    },
    { label: "Actions", render: actions },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Fleet Management"
          title="Buses"
          description="Manage fleet records, route assignments, categories, capacity, condition, and current status."
          actions={
            <Button icon={Plus} onClick={() => handleOpenModal(null)}>
              Assign Bus
            </Button>
          }
        />
        {error && <ErrorState title="Fleet unavailable" message={error} />}
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-safar-gray" />
          <input
            className="focus-ring h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm"
            placeholder="Search bus, route, driver, or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {loading ? (
          <Loading label="Loading fleet buses" />
        ) : visible.length ? (
          <ResponsiveDataList
            columns={columns}
            rows={visible}
            renderMobile={(bus) => (
              <article className="rounded-2xl bg-white p-4 text-safar-ink shadow-sm ring-1 ring-slate-200 transition hover:bg-safar-mint/70 hover:text-safar-ink">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-safar-ink">
                      {bus.name}{" "}
                      <span className="text-sm font-medium text-safar-gray">{bus.number}</span>
                    </h2>
                    <p className="mt-1 text-sm text-safar-gray">
                      {bus.type} | {bus.capacity} seats
                    </p>
                  </div>
                  <AdminStatusBadge status={bus.status} />
                </div>
                <p className="mt-3 text-sm font-medium text-safar-ink">{bus.route}</p>
                <p className="mt-1 text-xs text-safar-gray">
                  Driver: {bus.assignedDriver || "Unassigned"}
                </p>
                <div className="mt-4">{actions(bus)}</div>
              </article>
            )}
          />
        ) : (
          <EmptyState
            title={buses.length ? "No buses match your search" : "No buses in the fleet"}
            message={
              buses.length
                ? "Try another bus name, number, route, driver, or category."
                : "Add a bus to make it available for daily assignments."
            }
          />
        )}
      </div>

      <AdminFormModal
        open={Boolean(form)}
        title={selectedBus ? `Configure ${selectedBus.name}` : "Assign Bus to Route"}
        onClose={() => setForm(null)}
        onSubmit={submit}
        submitLabel={form?.id ? "Update Bus" : "Save Assignment"}
        loading={saving}
      >
        {form && (
          <div className="space-y-4">
            {/* Database-driven Bus Selection */}
            <div>
              <Select
                label="Select Bus"
                value={form.busId}
                onChange={(e) => handleBusSelect(e.target.value)}
                required
              >
                <option value="" disabled>
                  -- Select an existing bus from database --
                </option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.name} ({bus.number})
                  </option>
                ))}
              </Select>
              {selectedBus && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-safar-ink">
                  <span className="font-bold">{selectedBus.name}</span>
                  <span className="text-safar-gray">
                    {" "}
                    · Number / Plate: <span className="font-semibold text-safar-ink">{selectedBus.number}</span> · Assigned Driver: {selectedBus.assignedDriver || "None"}
                  </span>
                </div>
              )}
            </div>

            {/* Database-driven Route Selection */}
            <div>
              <Select
                label="Select Route"
                value={form.routeId}
                onChange={(e) => setForm({ ...form, routeId: e.target.value })}
                required
              >
                <option value="" disabled>
                  -- Select an existing route from database --
                </option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name} ({route.direction || `${route.start} → ${route.destination}`})
                  </option>
                ))}
              </Select>
              {selectedRoute && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-safar-ink">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-safar-ink">{selectedRoute.name}</span>
                    <span className="font-semibold text-safar-teal">{selectedRoute.direction}</span>
                  </div>
                  <div className="mt-1 text-safar-gray">
                    Pathway: <span className="font-medium text-safar-ink">{selectedRoute.start} → {selectedRoute.destination}</span>
                  </div>
                  {selectedRoute.stops?.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold text-safar-gray mb-1">
                        Ordered Stoppages ({selectedRoute.stops.length}):
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 font-medium text-safar-ink">
                        {selectedRoute.stops.map((stop, index) => (
                          <span key={stop} className="inline-flex items-center gap-1">
                            <span className="rounded bg-white px-1.5 py-0.5 border border-slate-200 text-slate-700">
                              {index + 1}. {stop}
                            </span>
                            {index < selectedRoute.stops.length - 1 && (
                              <span className="text-safar-teal font-bold">→</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Category"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {["Student Bus", "Female Student Bus", "Teacher Bus", "Staff Bus"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Capacity</span>
                <input
                  className="focus-ring h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  min="10"
                  required
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </label>
            </div>

            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {[
                "On Time",
                "Boarding",
                "En Route",
                "Delayed",
                "Arrived",
                "Under Maintenance",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>

            <p className="rounded-xl bg-safar-mint px-3 py-2 text-xs text-safar-ink">
              Bus and route selection is fully database-driven. The backend validates and links records by their primary identifiers.
            </p>
          </div>
        )}
      </AdminFormModal>

      <Modal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently removes the bus through the backend. Existing reservation history remains governed by backend constraints."
        confirmLabel="Delete Bus"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </DashboardLayout>
  );
}
