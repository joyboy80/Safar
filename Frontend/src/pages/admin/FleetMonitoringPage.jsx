import { BusFront, Gauge, MapPin, Navigation, Timer, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/common/Badge";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LiveMap from "../../components/tracking/LiveMap";
import LiveStatusBadge from "../../components/tracking/LiveStatusBadge";
import PageHeader from "../../components/layout/PageHeader";
import useLiveTracking from "../../hooks/useLiveTracking";
import DashboardLayout from "../../layouts/DashboardLayout";
import { formatUpdatedAgo, isBusLive } from "../../utils/liveTracking";

export default function FleetMonitoringPage() {
  const { buses, connectionStatus, error } = useLiveTracking();
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const activeBuses = useMemo(() => buses
    .filter((bus) => !["Offline", "Completed"].includes(bus.status))
    .map((bus, index) => ({ bus, index, live: isBusLive(bus) }))
    .sort((a, b) => Number(b.live) - Number(a.live) || a.index - b.index)
    .map((item) => item.bus), [buses]);
  const liveCount = activeBuses.filter((bus) => isBusLive(bus)).length;
  const visibleBuses = useMemo(() => activeBuses.filter((bus) => statusFilter === "All" || bus.status === statusFilter), [activeBuses, statusFilter]);

  useEffect(() => {
    if (!visibleBuses.some((bus) => bus.id === selectedId)) setSelectedId(visibleBuses[0]?.id || "");
  }, [selectedId, visibleBuses]);

  const selected = activeBuses.find((bus) => bus.id === selectedId) || visibleBuses[0];
  const statuses = ["All", ...new Set(activeBuses.map((bus) => bus.status))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Live Fleet"
          title="Fleet monitoring"
          description="Monitor backend-reported bus locations, speed, ETA, and operational status."
          actions={<Badge tone={connectionStatus === "connected" ? "success" : "warning"}>{connectionStatus === "connected" ? "Live connection" : connectionStatus === "error" ? "Unavailable" : "Connecting"}</Badge>}
        />

        {error && !buses.length && <ErrorState title="Fleet monitoring unavailable" message={error} />}
        {!error && connectionStatus === "connected" && !activeBuses.length && <EmptyState title="No active buses" message="The backend is not reporting any active fleet positions." />}

        {activeBuses.length > 0 && <><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-safar-gray">{visibleBuses.length} buses visible{liveCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{liveCount} live GPS</span>}</p>
          <label className="flex items-center gap-2 text-sm font-semibold text-safar-ink">Status<select className="focus-ring h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0"><LiveMap buses={visibleBuses} selectedId={selected?.id} onSelect={setSelectedId} className="xl:min-h-[620px]" /></div>
          {selected && (
            <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-safar-teal">{selected.id}</p><h2 className="mt-1 text-xl font-bold text-safar-ink">{selected.name}</h2><p className="text-sm text-safar-gray">{selected.busNumber} | {selected.category}</p></div><LiveStatusBadge status={selected.status} /></div>
              <dl className="mt-6 divide-y divide-slate-100">
                {[
                  [UserRound, "Driver", selected.assignedDriver],
                  [Navigation, "Route", selected.route],
                  [MapPin, "Current location", selected.currentLocation.label],
                  [BusFront, "Next stop", selected.nextStop],
                  [Gauge, "Speed", `${selected.speed} km/h`],
                  [Timer, "ETA", `${selected.etaMinutes} min${selected.delayMinutes ? ` (+${selected.delayMinutes} delayed)` : ""}`],
                  [Navigation, "GPS signal", isBusLive(selected) ? "Live — driver is sharing location" : `Last update ${formatUpdatedAgo(selected.updatedAt)}`],
                ].map(([Icon, label, value]) => <div key={label} className="flex gap-3 py-4"><Icon className="h-5 w-5 shrink-0 text-safar-teal" /><div className="min-w-0"><dt className="text-xs font-bold uppercase text-safar-gray">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-safar-ink">{value}</dd></div></div>)}
              </dl>
            </aside>
          )}
        </section></>}
      </div>
    </DashboardLayout>
  );
}
