import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./liveMap.css";
import { BusFront, Gauge, LocateFixed, MapPin, Maximize2, Timer } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { STATUS_COLORS, busPosition, formatUpdatedAgo, isBusLive } from "../../utils/liveTracking";
import LiveStatusBadge from "./LiveStatusBadge";

const center = [91.9716, 22.4637]; // Lng, Lat for Mapbox (CUET)
const MAP_STYLES = {
  streets: { label: "Streets", url: "mapbox://styles/mapbox/streets-v12" },
  satellite: { label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  dark: { label: "Night", url: "mapbox://styles/mapbox/dark-v11" },
};
const BUS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/></svg>';

const isCompactScreen = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches;
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function createMarkerElement() {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "safar-bus-marker";
  element.innerHTML = `<span class="safar-bus-marker__pulse"></span><span class="safar-bus-marker__body">${BUS_ICON}</span><span class="safar-bus-marker__label"></span>`;
  return element;
}

function paintMarker(element, bus, { selected, highlighted, live }) {
  element.style.setProperty("--marker-color", STATUS_COLORS[bus.status] || STATUS_COLORS.Running);
  element.classList.toggle("is-selected", selected);
  element.classList.toggle("is-highlighted", highlighted);
  element.classList.toggle("is-live", live);
  element.classList.toggle("is-stale", !live);
  element.style.zIndex = selected ? "3" : highlighted ? "2" : "1";
  const name = bus.name || bus.busNumber || bus.id;
  element.querySelector(".safar-bus-marker__label").textContent = live ? `${name} · ${bus.speed ?? 0} km/h` : name;
  element.title = `${name} — ${bus.status}${live ? " (live)" : ""}`;
  element.setAttribute("aria-label", element.title);
}

function animateMarker(entry, target) {
  const from = entry.current;
  if (entry.frame) cancelAnimationFrame(entry.frame);
  const jump = !from || Math.abs(from[0] - target[0]) + Math.abs(from[1] - target[1]) > 0.05;
  if (jump || prefersReducedMotion()) {
    entry.current = target;
    entry.marker.setLngLat(target);
    entry.frame = null;
    return;
  }
  const start = performance.now();
  const duration = 1400;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    entry.current = [from[0] + (target[0] - from[0]) * eased, from[1] + (target[1] - from[1]) * eased];
    entry.marker.setLngLat(entry.current);
    entry.frame = t < 1 ? requestAnimationFrame(step) : null;
  };
  entry.frame = requestAnimationFrame(step);
}

export default function LiveMap({ buses: allBuses, selectedId, highlightedId, onSelect, className = "", follow = false, showUserLocation = true, autoLocate = false, liveOnly = true }) {
  // Only plot buses whose position comes from a driver's live GPS, unless told otherwise.
  const buses = useMemo(() => (liveOnly ? allBuses.filter((bus) => isBusLive(bus)) : allBuses), [allBuses, liveOnly]);
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  const busesRef = useRef(buses);
  const fittedKeyRef = useRef("");
  const lastSelectedRef = useRef(null);
  const appliedStyleRef = useRef(null);
  const geolocateRef = useRef(null);
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [styleChoice, setStyleChoice] = useState(null);
  const [following, setFollowing] = useState(follow);
  const [now, setNow] = useState(() => Date.now());
  const [compact, setCompact] = useState(isCompactScreen);

  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 639px)");
    if (!query) return undefined;
    const onChange = () => setCompact(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  onSelectRef.current = onSelect;
  busesRef.current = buses;

  const activeStyle = styleChoice || (resolvedTheme === "dark" ? "dark" : "streets");
  const selected = buses.find((bus) => bus.id === selectedId);
  const selectedPoint = selected ? busPosition(selected) : null;
  const liveCount = useMemo(() => buses.filter((bus) => isBusLive(bus, now)).length, [buses, now]);
  const plottedCount = useMemo(() => buses.filter((bus) => busPosition(bus)).length, [buses]);
  const legend = useMemo(() => [...new Set(buses.map((bus) => bus.status).filter(Boolean))], [buses]);

  useEffect(() => { setFollowing(follow); }, [follow]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Create the map once.
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
    if (!token || token === "YOUR_MAPBOX_ACCESS_TOKEN_HERE") {
      setError("Mapbox is not configured. Replace YOUR_MAPBOX_ACCESS_TOKEN_HERE with your real token in Frontend/.env.");
      return undefined;
    }
    if (!elementRef.current) return undefined;

    let map;
    try {
      mapboxgl.accessToken = token;
      appliedStyleRef.current = activeStyle;
      map = new mapboxgl.Map({
        container: elementRef.current,
        style: MAP_STYLES[activeStyle].url,
        center,
        zoom: 13,
        attributionControl: false,
      });
    } catch (mapError) {
      setError(mapError?.message || "The map could not be loaded in this browser.");
      return undefined;
    }

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: !isCompactScreen() }), "top-right");
    let geolocate = null;
    if (showUserLocation) {
      geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
        showAccuracyCircle: true,
      });
      map.addControl(geolocate, "top-right");
      geolocateRef.current = geolocate;
    }
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => setReady(true));
    map.on("dragstart", () => setFollowing(false));
    map.on("error", (event) => {
      if (event?.error?.status === 401) setError("Mapbox rejected the access token. Check VITE_MAPBOX_ACCESS_TOKEN in Frontend/.env.");
    });
    mapRef.current = map;

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.resize()) : null;
    resizeObserver?.observe(elementRef.current);

    const markers = markersRef.current;
    return () => {
      resizeObserver?.disconnect();
      markers.forEach((entry) => { if (entry.frame) cancelAnimationFrame(entry.frame); entry.marker.remove(); });
      markers.clear();
      map.remove();
      mapRef.current = null;
      geolocateRef.current = null;
      fittedKeyRef.current = "";
      setReady(false);
    };
    // The map instance is created once; style changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoLocate || !ready) return;
    geolocateRef.current?.trigger();
  }, [autoLocate, ready]);

  // Switch base style (theme change or user choice). DOM markers survive setStyle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyleRef.current === activeStyle) return;
    appliedStyleRef.current = activeStyle;
    map.setStyle(MAP_STYLES[activeStyle].url);
  }, [activeStyle]);

  const fitAll = useCallback((animate = true) => {
    const map = mapRef.current;
    if (!map) return;
    const points = busesRef.current.map(busPosition).filter(Boolean);
    if (!points.length) return;
    const duration = animate && !prefersReducedMotion() ? 900 : 0;
    if (points.length === 1) {
      map.easeTo({ center: points[0], zoom: Math.max(map.getZoom(), 15), duration });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(points[0], points[0]);
    points.forEach((point) => bounds.extend(point));
    const padding = isCompactScreen() ? { top: 80, bottom: 120, left: 40, right: 60 } : { top: 90, bottom: 150, left: 60, right: 70 };
    map.fitBounds(bounds, { padding, maxZoom: 15.5, duration });
  }, []);

  // Keep one marker per bus and glide it to new positions instead of re-creating markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set();

    buses.forEach((bus) => {
      const point = busPosition(bus);
      if (!point) return;
      seen.add(bus.id);
      let entry = markers.get(bus.id);
      if (!entry) {
        const element = createMarkerElement();
        const busId = bus.id;
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current?.(busId);
        });
        const marker = new mapboxgl.Marker({ element, anchor: "center" }).setLngLat(point).addTo(map);
        entry = { marker, element, current: point, frame: null };
        markers.set(bus.id, entry);
      } else {
        animateMarker(entry, point);
      }
      paintMarker(entry.element, bus, { selected: bus.id === selectedId, highlighted: bus.id === highlightedId, live: isBusLive(bus) });
    });

    markers.forEach((entry, id) => {
      if (seen.has(id)) return;
      if (entry.frame) cancelAnimationFrame(entry.frame);
      entry.marker.remove();
      markers.delete(id);
    });

    // Only re-frame the camera when the set of buses changes, so users can pan freely between updates.
    const key = [...seen].sort().join("|");
    if (key && key !== fittedKeyRef.current) {
      const firstFit = !fittedKeyRef.current;
      fittedKeyRef.current = key;
      if (!following) fitAll(!firstFit);
    }
  }, [buses, selectedId, highlightedId, fitAll, following]);

  // Fly to a bus when the user picks a different one.
  useEffect(() => {
    const map = mapRef.current;
    const previous = lastSelectedRef.current;
    lastSelectedRef.current = selectedId || null;
    if (!map || !selectedId || !previous || previous === selectedId || !selectedPoint) return;
    map.easeTo({ center: selectedPoint, zoom: Math.max(map.getZoom(), 14.5), duration: prefersReducedMotion() ? 0 : 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Follow mode keeps the selected bus centred as it moves.
  const followLng = selectedPoint?.[0];
  const followLat = selectedPoint?.[1];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !following || !Number.isFinite(followLng) || !Number.isFinite(followLat)) return;
    map.easeTo({ center: [followLng, followLat], zoom: Math.max(map.getZoom(), 15), duration: prefersReducedMotion() ? 0 : 1200 });
  }, [following, followLng, followLat]);

  const selectedLive = selected ? isBusLive(selected, now) : false;
  const glass = "bg-white/90 ring-1 ring-black/5 backdrop-blur-md shadow-sm dark:bg-slate-900/85 dark:ring-white/10";

  return <div className={`relative isolate h-[62vh] min-h-[380px] max-h-[620px] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-float ring-1 ring-slate-200/60 sm:h-auto sm:max-h-none sm:min-h-[440px] sm:rounded-3xl dark:bg-slate-800 dark:ring-slate-700/50 ${className}`}>
    <div ref={elementRef} className="absolute inset-0" />

    {error && <div className="absolute inset-0 grid place-items-center bg-slate-50/80 backdrop-blur-sm p-6 text-center z-10 dark:bg-slate-900/80"><div><MapPin className="mx-auto h-10 w-10 text-brand-maroon dark:text-pink-400" /><h2 className="mt-4 text-xl font-display font-bold text-safar-ink">Mapbox unavailable</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-safar-gray">{error}</p></div></div>}

    {!error && <>
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex max-w-[calc(100%-64px)] flex-col items-start gap-1.5 sm:left-4 sm:top-4 sm:gap-2">
        <div className={`pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-safar-ink sm:gap-2.5 sm:px-3.5 sm:py-2 sm:text-xs dark:text-slate-100 ${glass}`}>
          <span className="relative flex h-2.5 w-2.5">
            {liveCount > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
            <span className={`relative h-2.5 w-2.5 rounded-full ${liveCount > 0 ? "bg-emerald-500" : "bg-slate-400"}`} />
          </span>
          {liveCount > 0
            ? <span>Live<span className="hidden sm:inline"> GPS</span> · {liveCount} {liveCount === 1 ? "bus" : "buses"}<span className="hidden sm:inline"> moving</span></span>
            : <span><span className="hidden sm:inline">Live GPS · </span>Waiting for drivers</span>}
        </div>
        <div className={`pointer-events-auto flex rounded-full p-0.5 text-[10px] font-bold sm:p-1 sm:text-[11px] ${glass}`} role="group" aria-label="Map style">
          {Object.entries(MAP_STYLES).map(([key, item]) => (
            <button key={key} type="button" onClick={() => setStyleChoice(key)} aria-pressed={activeStyle === key}
              className={`rounded-full px-2 py-1 transition sm:px-2.5 ${activeStyle === key ? "bg-safar-teal text-white shadow-sm" : "text-safar-gray hover:text-safar-ink dark:text-slate-300"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`absolute right-2.5 z-10 flex flex-col gap-2 ${compact ? "top-[118px]" : "top-[150px]"}`}>
        <button type="button" onClick={() => { setFollowing(false); fitAll(); }} title="Show all buses" aria-label="Show all buses"
          className={`focus-ring grid h-9 w-9 place-items-center rounded-xl text-safar-ink transition hover:text-safar-teal dark:text-slate-100 ${glass}`}>
          <Maximize2 className="h-4 w-4" />
        </button>
        {selectedPoint && <button type="button" onClick={() => setFollowing((value) => !value)} title={following ? "Stop following" : "Follow selected bus"} aria-pressed={following} aria-label="Follow selected bus"
          className={`focus-ring grid h-9 w-9 place-items-center rounded-xl transition ${following ? "bg-safar-teal text-white shadow-glow" : `text-safar-ink hover:text-safar-teal dark:text-slate-100 ${glass}`}`}>
          <LocateFixed className="h-4 w-4" />
        </button>}
      </div>

      {ready && liveOnly && buses.length === 0 && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 mx-auto w-fit -translate-y-1/2 px-4">
        <div className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold text-safar-gray ${glass}`}>No bus is sharing live GPS right now.<br /><span className="text-xs font-medium">Buses appear here as soon as a driver starts a trip.</span></div>
      </div>}

      {ready && buses.length > 0 && plottedCount === 0 && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 mx-auto w-fit -translate-y-1/2 px-4">
        <div className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold text-safar-gray ${glass}`}>Waiting for the first GPS fix from the driver…</div>
      </div>}

      {legend.length > 1 && <div className={`absolute bottom-10 left-4 z-10 hidden max-w-[45%] flex-wrap gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-[11px] font-semibold text-safar-gray dark:text-slate-300 md:flex ${glass}`}>
        {legend.map((status) => <span key={status} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.Running }} />{status}</span>)}
      </div>}

      {selected && <div className="absolute bottom-9 left-2.5 right-2.5 z-10 rounded-2xl bg-white/95 p-3 shadow-float ring-1 ring-black/5 backdrop-blur-xl sm:bottom-10 sm:left-auto sm:right-4 sm:w-80 sm:p-4 dark:bg-slate-900/95 dark:ring-white/10 animate-slide-up">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-safar-ink sm:text-base"><BusFront className="mr-1.5 inline h-4 w-4 text-brand-maroon sm:mr-2 sm:h-5 sm:w-5 dark:text-pink-400" />{selected.name}</p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-safar-gray sm:mt-1 sm:text-xs">{selected.currentLocation?.label || "Location not reported"}</p>
          </div>
          <LiveStatusBadge status={selected.status} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-safar-ink sm:hidden">
          <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-safar-teal" />{selected.speed ?? 0} km/h</span>
          <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5 text-safar-teal" />ETA {selected.etaMinutes ?? "—"} min</span>
          <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${selectedLive ? "bg-emerald-500" : "bg-slate-400"}`} />{selectedLive ? "Live" : formatUpdatedAgo(selected.updatedAt, now)}</span>
        </div>
        <div className="mt-3 hidden grid-cols-3 gap-2 text-center sm:grid">
          <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800"><Gauge className="mx-auto h-4 w-4 text-safar-teal" /><p className="mt-1 text-xs font-bold text-safar-ink">{selected.speed ?? 0} km/h</p></div>
          <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800"><Timer className="mx-auto h-4 w-4 text-safar-teal" /><p className="mt-1 text-xs font-bold text-safar-ink">{selected.etaMinutes ?? "—"} min</p></div>
          <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800">
            <span className={`mx-auto block h-4 w-4 rounded-full border-4 ${selectedLive ? "border-emerald-200 bg-emerald-500 dark:border-emerald-900" : "border-slate-200 bg-slate-400 dark:border-slate-700"}`} />
            <p className="mt-1 truncate text-xs font-bold text-safar-ink">{selectedLive ? "Live" : formatUpdatedAgo(selected.updatedAt, now)}</p>
          </div>
        </div>
      </div>}
    </>}
  </div>;
}
