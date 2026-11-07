import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../config/supabase.js";
import AppError from "../utils/AppError.js";
import { PREDEFINED_ROUTES, getAllowedCategoriesForUser } from "./transportService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");
const BUSES_META_FILE = path.join(DATA_DIR, "buses_meta.json");

export const BUS_STATUSES = Object.freeze({
  ONLINE: "Online",
  RUNNING: "Running",
  STOPPED: "Stopped",
  MAINTENANCE: "Maintenance",
});

export const SCHEDULE_STATUSES = Object.freeze({
  SCHEDULED: "Scheduled",
  RUNNING: "Running",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export const BUS_CATEGORIES = [
  "AC",
  "Non-AC",
  "University Shuttle",
  "Student Bus",
  "Female Student Bus",
  "Teacher Bus",
  "Staff Bus",
];

// ─── File Storage Helpers ───
async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SCHEDULES_FILE);
  } catch {
    await fs.writeFile(SCHEDULES_FILE, JSON.stringify([], null, 2), "utf8");
  }
  try {
    await fs.access(BUSES_META_FILE);
  } catch {
    await fs.writeFile(BUSES_META_FILE, JSON.stringify({}, null, 2), "utf8");
  }
}

async function readSchedulesData() {
  await ensureDataFiles();
  try {
    const raw = await fs.readFile(SCHEDULES_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

async function writeSchedulesData(data) {
  await ensureDataFiles();
  await fs.writeFile(SCHEDULES_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readBusesMetaData() {
  await ensureDataFiles();
  try {
    const raw = await fs.readFile(BUSES_META_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function writeBusesMetaData(data) {
  await ensureDataFiles();
  await fs.writeFile(BUSES_META_FILE, JSON.stringify(data, null, 2), "utf8");
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// ─── BUS MANAGEMENT ───

export async function listAllBuses() {
  const admin = getSupabaseAdmin();
  const [{ data: dbBuses, error }, meta] = await Promise.all([
    admin.from("buses").select("*").order("name"),
    readBusesMetaData(),
  ]);

  if (error) {
    console.warn("[Fleet] Supabase buses fetch failed, using fallback:", error.message);
  }

  const list = dbBuses || [];
  return list.map((b) => {
    const busMeta = meta[b.id] || {};
    const operationalStatus = b.status === "Running" ? BUS_STATUSES.RUNNING
      : b.status === "Maintenance" ? BUS_STATUSES.MAINTENANCE
      : b.status === "Stopped" ? BUS_STATUSES.STOPPED
      : BUS_STATUSES.ONLINE;

    const route = b.route || busMeta.route || "Not Assigned";
    const routeId = busMeta.routeId || b.route_id || null;
    let stops = Array.isArray(b.stops) && b.stops.length > 0 ? b.stops : (busMeta.stops || []);
    if (!stops.length && route) {
      const predefined = PREDEFINED_ROUTES.find((r) => r.name?.toLowerCase() === route.toLowerCase() || r.id === routeId);
      if (predefined?.stops) stops = predefined.stops;
    }

    return {
      id: b.id,
      busId: b.id,
      name: b.name,
      busName: b.name,
      registrationNumber: b.number || busMeta.registrationNumber || "—",
      number: b.number,
      category: busMeta.category || b.category || "Student Bus",
      capacity: Number(b.capacity) || 40,
      description: busMeta.description || b.description || "",
      imageUrl: busMeta.imageUrl || b.image_url || null,
      operationalStatus,
      status: operationalStatus,
      route,
      routeName: route,
      routeId,
      stops,
      departureTime: b.departure_time,
      assignedDriverName: b.assigned_driver_name,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    };
  });
}

export async function saveBusRecord(input) {
  const name = String(input.busName || input.name || "").trim();
  const registrationNumber = String(input.registrationNumber || input.number || "").trim();
  const category = String(input.category || "Student Bus").trim();
  const capacity = Number.parseInt(input.capacity, 10);
  const route = String(input.route || input.routeName || "CUET Campus - Station").trim();
  const routeId = input.routeId || null;
  let stops = Array.isArray(input.stops) && input.stops.length > 0 ? input.stops : null;
  if (!stops) {
    const predefined = PREDEFINED_ROUTES.find(
      (r) => r.id === routeId || r.name?.toLowerCase() === route.toLowerCase()
    );
    stops = predefined?.stops?.length ? predefined.stops : ["CUET Campus", "Station"];
  }
  const description = String(input.description || "").trim();
  const imageUrl = input.imageUrl || null;
  const operationalStatus = [BUS_STATUSES.ONLINE, BUS_STATUSES.RUNNING, BUS_STATUSES.STOPPED, BUS_STATUSES.MAINTENANCE]
    .includes(input.operationalStatus || input.status)
    ? (input.operationalStatus || input.status)
    : BUS_STATUSES.ONLINE;

  if (!name || name.length < 2 || name.length > 80) {
    throw new AppError(400, "Bus name must be between 2 and 80 characters.", "INVALID_BUS_NAME");
  }
  if (!registrationNumber) {
    throw new AppError(400, "Registration number is required.", "INVALID_REGISTRATION_NUMBER");
  }
  if (!Number.isInteger(capacity) || capacity <= 0 || capacity > 120) {
    throw new AppError(400, "Capacity must be an integer between 1 and 120.", "INVALID_CAPACITY");
  }

  const admin = getSupabaseAdmin();
  const busId = input.id || input.busId || `BUS-${randomUUID().slice(0, 8).toUpperCase()}`;

  // Check unique registration number
  const { data: existingReg } = await admin
    .from("buses")
    .select("id, number")
    .ilike("number", registrationNumber)
    .neq("id", busId)
    .maybeSingle();

  if (existingReg) {
    throw new AppError(409, `A bus with registration number "${registrationNumber}" already exists.`, "DUPLICATE_REGISTRATION");
  }

  // Supabase check constraint accepts: 'Student Bus', 'Female Student Bus', 'Teacher Bus', 'Staff Bus'
  const validDbCategories = ["Student Bus", "Female Student Bus", "Teacher Bus", "Staff Bus"];
  const dbCategory = validDbCategories.includes(category) ? category : "Student Bus";

  const dbPayload = {
    id: busId,
    name,
    number: registrationNumber,
    category: dbCategory,
    capacity,
    route,
    stops,
    departure_time: input.departureTime || "07:30 AM",
    arrival_time: input.arrivalTime || "08:30 AM",
    status: operationalStatus,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("buses")
    .upsert(dbPayload)
    .select("*")
    .single();

  if (error) {
    throw new AppError(500, `Failed to save bus: ${error.message}`, "BUS_SAVE_FAILED");
  }

  // Persist additional metadata
  const meta = await readBusesMetaData();
  meta[busId] = {
    category,
    route,
    routeId,
    stops,
    description,
    imageUrl,
    registrationNumber,
    operationalStatus,
    updatedAt: new Date().toISOString(),
  };
  await writeBusesMetaData(meta);

  return {
    id: data.id,
    busId: data.id,
    name: data.name,
    busName: data.name,
    registrationNumber: data.number,
    number: data.number,
    category,
    capacity: data.capacity,
    route,
    routeName: route,
    routeId,
    stops,
    description,
    imageUrl,
    operationalStatus,
    status: operationalStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateBusOperationalStatus(busId, newStatus) {
  if (!Object.values(BUS_STATUSES).includes(newStatus)) {
    throw new AppError(400, `Status must be one of: ${Object.values(BUS_STATUSES).join(", ")}`, "INVALID_STATUS");
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("buses")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", busId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(404, "Bus not found.", "BUS_NOT_FOUND");
  }

  const meta = await readBusesMetaData();
  if (meta[busId]) {
    meta[busId].operationalStatus = newStatus;
    await writeBusesMetaData(meta);
  }

  return {
    id: data.id,
    busName: data.name,
    operationalStatus: newStatus,
    status: newStatus,
  };
}

export async function removeBusRecord(busId) {
  // Check if bus is currently on an active running schedule
  const schedules = await readSchedulesData();
  const runningSchedule = schedules.find(
    (s) => s.busId === busId && s.scheduleStatus === SCHEDULE_STATUSES.RUNNING
  );

  if (runningSchedule) {
    throw new AppError(
      400,
      `Cannot delete bus "${runningSchedule.busName}" because it has an active trip currently in progress. Complete or terminate the trip first.`,
      "BUS_TRIP_ACTIVE"
    );
  }

  const admin = getSupabaseAdmin();

  // Cancel any future schedules for this bus
  const today = todayDate();
  const updatedSchedules = schedules.map((s) => {
    if (s.busId === busId && s.scheduleDate >= today && s.scheduleStatus === SCHEDULE_STATUSES.SCHEDULED) {
      return { ...s, scheduleStatus: SCHEDULE_STATUSES.CANCELLED, updatedAt: new Date().toISOString() };
    }
    return s;
  });
  await writeSchedulesData(updatedSchedules);

  // Delete from Supabase
  const { error } = await admin.from("buses").delete().eq("id", busId);
  if (error) {
    // If foreign key constraint exists, mark Stopped instead
    console.warn("[Fleet] Direct delete had constraint, marking bus as Stopped:", error.message);
    await admin.from("buses").update({ status: BUS_STATUSES.STOPPED }).eq("id", busId);
  }

  const meta = await readBusesMetaData();
  delete meta[busId];
  await writeBusesMetaData(meta);

  return { success: true, message: "Bus removed successfully." };
}

// ─── INTEGRATED SCHEDULING ───

export async function listAllSchedules({ date, busId, driverId, status } = {}) {
  const [schedules, busesList] = await Promise.all([
    readSchedulesData(),
    listAllBuses(),
  ]);

  const busMap = new Map(busesList.map((b) => [b.id, b]));

  let filtered = schedules.map((s) => {
    const liveBus = busMap.get(s.busId);
    return {
      ...s,
      currentBusStatus: liveBus?.operationalStatus || BUS_STATUSES.ONLINE,
      busCategory: s.busCategory || liveBus?.category || "Student Bus",
      busRegistrationNumber: s.registrationNumber || liveBus?.registrationNumber || "—",
    };
  });

  if (date) {
    filtered = filtered.filter((s) => s.scheduleDate === date);
  }
  if (busId) {
    filtered = filtered.filter((s) => s.busId === busId);
  }
  if (driverId) {
    filtered = filtered.filter((s) => s.driverId === driverId);
  }
  if (status) {
    filtered = filtered.filter((s) => s.scheduleStatus === status);
  }

  // Sort by date descending, then departureTime ascending
  return filtered.sort((a, b) => {
    if (a.scheduleDate !== b.scheduleDate) {
      return b.scheduleDate.localeCompare(a.scheduleDate);
    }
    return a.departureTime.localeCompare(b.departureTime);
  });
}

export async function createScheduleRecord(input, adminUser) {
  const busId = String(input.busId || "").trim();
  const driverId = String(input.driverId || input.driverProfileId || "").trim();
  const routeId = String(input.routeId || "").trim();
  const departureTime = String(input.departureTime || "").trim();
  const scheduleDate = String(input.scheduleDate || input.serviceDate || "").trim();

  if (!busId) throw new AppError(400, "Please select a registered bus.", "MISSING_BUS");
  if (!driverId) throw new AppError(400, "Please select an assigned driver.", "MISSING_DRIVER");
  if (!routeId) throw new AppError(400, "Please select an existing route.", "MISSING_ROUTE");
  if (!departureTime) throw new AppError(400, "Please select a departure time.", "MISSING_DEPARTURE_TIME");
  if (!scheduleDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
    throw new AppError(400, "Please select a valid schedule date (YYYY-MM-DD).", "INVALID_DATE");
  }

  const today = todayDate();
  if (scheduleDate < today) {
    throw new AppError(400, "Schedules cannot be created for past dates.", "PAST_DATE_NOT_ALLOWED");
  }

  // 1. Validate Bus
  const buses = await listAllBuses();
  const bus = buses.find((b) => b.id === busId);
  if (!bus) throw new AppError(404, "Selected bus not found.", "BUS_NOT_FOUND");
  if (bus.operationalStatus === BUS_STATUSES.MAINTENANCE) {
    throw new AppError(400, `Bus "${bus.name}" is currently under Maintenance and cannot be scheduled.`, "BUS_MAINTENANCE");
  }
  if (bus.operationalStatus === BUS_STATUSES.STOPPED) {
    throw new AppError(400, `Bus "${bus.name}" is currently Stopped and cannot be scheduled.`, "BUS_STOPPED");
  }
  if (scheduleDate === today && bus.operationalStatus === BUS_STATUSES.RUNNING) {
    throw new AppError(400, `Bus "${bus.name}" is currently on a running trip.`, "BUS_ALREADY_RUNNING");
  }

  // 2. Validate Driver
  const admin = getSupabaseAdmin();
  const { data: driverProfile, error: driverErr } = await admin
    .from("profiles")
    .select("id, full_name, user_type, is_active, is_verified")
    .eq("id", driverId)
    .single();

  if (driverErr || !driverProfile || driverProfile.user_type !== "DRIVER") {
    throw new AppError(400, "Selected driver is invalid or does not have DRIVER credentials.", "INVALID_DRIVER");
  }
  if (!driverProfile.is_active || !driverProfile.is_verified) {
    throw new AppError(400, "Selected driver account is not verified or active.", "DRIVER_INACTIVE");
  }

  // 3. Validate Route
  const route = PREDEFINED_ROUTES.find((r) => r.id === routeId);
  if (!route) {
    throw new AppError(404, "Selected route was not found in the Routes system.", "ROUTE_NOT_FOUND");
  }

  // 4. Validate Scheduling Conflicts (Overlap Checks)
  const existingSchedules = await readSchedulesData();
  const activeExisting = existingSchedules.filter(
    (s) => s.scheduleDate === scheduleDate && s.scheduleStatus !== SCHEDULE_STATUSES.CANCELLED
  );

  // Conflict A: Same bus at the same departure time on the same date
  const busConflict = activeExisting.find(
    (s) => s.busId === busId && s.departureTime.toLowerCase() === departureTime.toLowerCase()
  );
  if (busConflict) {
    throw new AppError(
      409,
      `Bus "${bus.name}" is already scheduled for ${departureTime} on ${scheduleDate} (${busConflict.routeName}).`,
      "BUS_SCHEDULE_CONFLICT"
    );
  }

  // Conflict B: Same driver at the same departure time on the same date
  const driverConflict = activeExisting.find(
    (s) => s.driverId === driverId && s.departureTime.toLowerCase() === departureTime.toLowerCase()
  );
  if (driverConflict) {
    throw new AppError(
      409,
      `Driver "${driverProfile.full_name}" is already assigned to a trip at ${departureTime} on ${scheduleDate}.`,
      "DRIVER_SCHEDULE_CONFLICT"
    );
  }

  const scheduleId = `SCH-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  const newSchedule = {
    id: scheduleId,
    scheduleId,
    busId: bus.id,
    busName: bus.name,
    registrationNumber: bus.registrationNumber,
    busCategory: bus.category,
    capacity: bus.capacity,
    driverId: driverProfile.id,
    driverName: driverProfile.full_name,
    routeId: route.id,
    routeName: route.name,
    routeDirection: route.direction,
    departureTime,
    scheduleDate,
    scheduleStatus: SCHEDULE_STATUSES.SCHEDULED,
    startedAt: null,
    completedAt: null,
    createdBy: adminUser?.id || null,
    createdAt: now,
    updatedAt: now,
  };

  existingSchedules.unshift(newSchedule);
  await writeSchedulesData(existingSchedules);

  // Mirror schedule into transport_trips and transport_schedules so Supabase is 100% synchronized
  try {
    await admin.from("transport_trips").upsert({
      id: scheduleId,
      bus_id: bus.id,
      route: route.name,
      stops: route.stops,
      departure_time: departureTime,
      arrival_time: departureTime,
      status: "Scheduled",
      service_date: scheduleDate,
      driver_profile_id: driverProfile.id,
      direction: route.direction?.includes("Station") ? "OUTBOUND" : "RETURN",
      reservation_status: "OPEN",
      operational_status: "SCHEDULED",
      updated_at: now,
    });

    await admin.from("transport_schedules").upsert({
      id: scheduleId,
      trip_id: scheduleId,
      bus_id: bus.id,
      service_date: scheduleDate,
      departure_time: departureTime,
      arrival_time: departureTime,
      schedule_type: "Regular",
      status: "Scheduled",
      updated_at: now,
    });
  } catch (syncErr) {
    console.warn("[Fleet] Syncing trip/schedule rows notice:", syncErr.message);
  }

  return newSchedule;
}

export async function updateScheduleRecord(scheduleId, updates) {
  const schedules = await readSchedulesData();
  const index = schedules.findIndex((s) => s.id === scheduleId);
  if (index === -1) {
    throw new AppError(404, "Schedule not found.", "SCHEDULE_NOT_FOUND");
  }

  const existing = schedules[index];
  if (existing.scheduleStatus === SCHEDULE_STATUSES.COMPLETED) {
    throw new AppError(400, "Completed schedules cannot be modified.", "SCHEDULE_COMPLETED");
  }

  // If changing driver, validate driver
  let driverName = existing.driverName;
  let driverId = existing.driverId;
  if (updates.driverId && updates.driverId !== existing.driverId) {
    const admin = getSupabaseAdmin();
    const { data: driver } = await admin.from("profiles").select("id, full_name").eq("id", updates.driverId).single();
    if (!driver) throw new AppError(400, "Driver not found.", "INVALID_DRIVER");
    driverId = driver.id;
    driverName = driver.full_name;
  }

  // If changing route
  let routeId = existing.routeId;
  let routeName = existing.routeName;
  let routeDirection = existing.routeDirection;
  if (updates.routeId && updates.routeId !== existing.routeId) {
    const route = PREDEFINED_ROUTES.find((r) => r.id === updates.routeId);
    if (!route) throw new AppError(404, "Route not found.", "ROUTE_NOT_FOUND");
    routeId = route.id;
    routeName = route.name;
    routeDirection = route.direction;
  }

  const updated = {
    ...existing,
    driverId,
    driverName,
    routeId,
    routeName,
    routeDirection,
    departureTime: updates.departureTime || existing.departureTime,
    scheduleDate: updates.scheduleDate || existing.scheduleDate,
    updatedAt: new Date().toISOString(),
  };

  schedules[index] = updated;
  await writeSchedulesData(schedules);

  return updated;
}

export async function cancelScheduleRecord(scheduleId) {
  const schedules = await readSchedulesData();
  const schedule = schedules.find((s) => s.id === scheduleId);
  if (!schedule) throw new AppError(404, "Schedule not found.", "SCHEDULE_NOT_FOUND");

  if (schedule.scheduleStatus === SCHEDULE_STATUSES.COMPLETED) {
    throw new AppError(400, "Completed schedules cannot be cancelled.", "SCHEDULE_ALREADY_COMPLETED");
  }

  schedule.scheduleStatus = SCHEDULE_STATUSES.CANCELLED;
  schedule.updatedAt = new Date().toISOString();

  // If bus was marked Running due to this schedule, reset bus to Online
  if (schedule.scheduleStatus === SCHEDULE_STATUSES.RUNNING) {
    await updateBusOperationalStatus(schedule.busId, BUS_STATUSES.ONLINE).catch(() => {});
  }

  await writeSchedulesData(schedules);

  // Sync to transport_trips and transport_schedules in Supabase
  const admin = getSupabaseAdmin();
  try {
    await admin.from("transport_trips").update({
      status: "Cancelled",
      operational_status: "CANCELLED",
      reservation_status: "CLOSED",
    }).eq("id", scheduleId);
  } catch {}
  try {
    await admin.from("transport_schedules").update({
      status: "Cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", scheduleId);
  } catch {}

  return schedule;
}

export async function deleteScheduleRecord(scheduleId) {
  const schedules = await readSchedulesData();
  const schedule = schedules.find((s) => s.id === scheduleId);
  if (!schedule) throw new AppError(404, "Schedule not found.", "SCHEDULE_NOT_FOUND");

  if (schedule.scheduleStatus === SCHEDULE_STATUSES.RUNNING) {
    throw new AppError(400, "Cannot delete an actively running schedule. Cancel or complete it first.", "SCHEDULE_RUNNING");
  }

  const remaining = schedules.filter((s) => s.id !== scheduleId);
  await writeSchedulesData(remaining);

  // Also remove from transport_schedules and transport_trips if present in Supabase
  const admin = getSupabaseAdmin();
  try {
    await admin.from("transport_schedules").delete().eq("id", scheduleId);
  } catch {}
  try {
    await admin.from("transport_trips").delete().eq("id", scheduleId);
  } catch {}

  return { success: true, message: "Schedule deleted." };
}

// ─── DRIVER TRIP CONTROLS ───

export async function getDriverSchedules(driverProfileId, date = todayDate()) {
  const schedules = await readSchedulesData();
  return schedules.filter(
    (s) => s.driverId === driverProfileId && s.scheduleDate === date
  ).map((s) => ({
    id: s.id,
    tripId: s.id,
    busId: s.busId,
    busName: s.busName,
    busNumber: s.registrationNumber,
    registrationNumber: s.registrationNumber,
    busCategory: s.busCategory,
    capacity: s.capacity,
    route: s.routeName,
    routeName: s.routeName,
    routeDirection: s.routeDirection,
    departureTime: s.departureTime,
    arrivalTime: s.departureTime,
    date: s.scheduleDate,
    scheduleDate: s.scheduleDate,
    status: s.scheduleStatus === SCHEDULE_STATUSES.RUNNING ? "In Progress"
      : s.scheduleStatus === SCHEDULE_STATUSES.COMPLETED ? "Completed"
      : s.scheduleStatus === SCHEDULE_STATUSES.CANCELLED ? "Cancelled"
      : "Upcoming",
    scheduleStatus: s.scheduleStatus,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
  }));
}

export async function driverStartScheduleTrip(driverProfileId, scheduleId) {
  const schedules = await readSchedulesData();
  const schedule = schedules.find((s) => s.id === scheduleId);

  if (!schedule) throw new AppError(404, "Assigned schedule not found.", "SCHEDULE_NOT_FOUND");
  if (schedule.driverId !== driverProfileId) {
    throw new AppError(403, "You can only control trips assigned to your own driver account.", "FORBIDDEN_TRIP_ACCESS");
  }
  if (schedule.scheduleStatus === SCHEDULE_STATUSES.RUNNING) {
    throw new AppError(400, "This trip is already running.", "TRIP_ALREADY_RUNNING");
  }
  if (schedule.scheduleStatus === SCHEDULE_STATUSES.COMPLETED) {
    throw new AppError(400, "This trip is already completed.", "TRIP_ALREADY_COMPLETED");
  }
  if (schedule.scheduleStatus === SCHEDULE_STATUSES.CANCELLED) {
    throw new AppError(400, "This trip was cancelled by the administrator.", "TRIP_CANCELLED");
  }

  const now = new Date().toISOString();
  schedule.scheduleStatus = SCHEDULE_STATUSES.RUNNING;
  schedule.startedAt = now;
  schedule.updatedAt = now;
  await writeSchedulesData(schedules);

  // Update bus status to Running
  await updateBusOperationalStatus(schedule.busId, BUS_STATUSES.RUNNING);

  // Sync to transport_trips, transport_schedules, and tracking_positions
  const admin = getSupabaseAdmin();
  try {
    await admin.from("transport_trips").update({
      status: "In Progress",
      operational_status: "IN_PROGRESS",
      updated_at: now,
    }).eq("id", scheduleId);
  } catch {}

  try {
    await admin.from("transport_schedules").update({
      status: "Running",
      updated_at: now,
    }).eq("id", scheduleId);
  } catch {}

  try {
    await admin.from("tracking_positions").upsert({
      bus_id: schedule.busId,
      status: "Running",
      updated_at: now,
    });
  } catch {}

  return {
    ...schedule,
    status: "In Progress",
  };
}

export async function driverCompleteScheduleTrip(driverProfileId, scheduleId) {
  const schedules = await readSchedulesData();
  const schedule = schedules.find((s) => s.id === scheduleId);

  if (!schedule) throw new AppError(404, "Assigned schedule not found.", "SCHEDULE_NOT_FOUND");
  if (schedule.driverId !== driverProfileId) {
    throw new AppError(403, "You can only control trips assigned to your own driver account.", "FORBIDDEN_TRIP_ACCESS");
  }
  if (schedule.scheduleStatus !== SCHEDULE_STATUSES.RUNNING) {
    throw new AppError(400, "Only a running trip can be marked as completed.", "INVALID_STATUS_TRANSITION");
  }

  const now = new Date().toISOString();
  schedule.scheduleStatus = SCHEDULE_STATUSES.COMPLETED;
  schedule.completedAt = now;
  schedule.updatedAt = now;
  await writeSchedulesData(schedules);

  // Release bus back to Online so it is available for next schedule!
  await updateBusOperationalStatus(schedule.busId, BUS_STATUSES.ONLINE);

  // Sync to transport_trips, transport_schedules, and tracking
  const admin = getSupabaseAdmin();
  try {
    await admin.from("transport_trips").update({
      status: "Completed",
      operational_status: "COMPLETED",
      reservation_status: "CLOSED",
      updated_at: now,
    }).eq("id", scheduleId);
  } catch {}

  try {
    await admin.from("transport_schedules").update({
      status: "Completed",
      updated_at: now,
    }).eq("id", scheduleId);
  } catch {}

  try {
    await admin.from("tracking_positions").update({
      status: "Completed",
      speed: 0,
      eta_minutes: 0,
      updated_at: now,
    }).eq("bus_id", schedule.busId);
  } catch {}

  return {
    ...schedule,
    status: "Completed",
  };
}

// ─── USER SCHEDULE VISIBILITY ───

export async function getUserDashboardSchedules(user, date = todayDate()) {
  const all = await listAllSchedules({ date });

  // Exclude cancelled schedules from passenger public list
  const activeSchedules = all.filter((s) => s.scheduleStatus !== SCHEDULE_STATUSES.CANCELLED);

  const allowedCategories = getAllowedCategoriesForUser(user);
  const eligibleSchedules = activeSchedules.filter((s) => {
    if (!allowedCategories.length) return true;
    return allowedCategories.includes(s.busCategory);
  });

  return eligibleSchedules.map((s) => ({
    id: s.busId,
    busId: s.busId,
    scheduleId: s.id,
    tripId: s.id,
    name: s.busName,
    busName: s.busName,
    busNumber: s.registrationNumber,
    registrationNumber: s.registrationNumber,
    category: s.busCategory,
    busCategory: s.busCategory,
    type: s.busCategory,
    capacity: s.capacity,
    availableSeats: s.capacity,
    route: s.routeName,
    routeName: s.routeName,
    routeDirection: s.routeDirection,
    departureTime: s.departureTime,
    arrivalTime: s.departureTime,
    scheduleDate: s.scheduleDate,
    driverName: s.driverName,
    busOperationalStatus: s.currentBusStatus,
    scheduleStatus: s.scheduleStatus,
    status: s.scheduleStatus === SCHEDULE_STATUSES.RUNNING ? "In Progress"
      : s.scheduleStatus === SCHEDULE_STATUSES.COMPLETED ? "Completed"
      : "Scheduled",
  }));
}

