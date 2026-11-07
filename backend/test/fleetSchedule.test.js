import assert from "node:assert/strict";
import test from "node:test";
import {
  BUS_CATEGORIES,
  BUS_STATUSES,
  SCHEDULE_STATUSES,
  saveBusRecord,
  updateBusOperationalStatus,
  createScheduleRecord,
} from "../src/services/fleetScheduleService.js";

test("bus fleet constants define authoritative statuses and categories", () => {
  assert.equal(BUS_STATUSES.ONLINE, "Online");
  assert.equal(BUS_STATUSES.RUNNING, "Running");
  assert.equal(BUS_STATUSES.STOPPED, "Stopped");
  assert.equal(BUS_STATUSES.MAINTENANCE, "Maintenance");

  assert.equal(SCHEDULE_STATUSES.SCHEDULED, "Scheduled");
  assert.equal(SCHEDULE_STATUSES.RUNNING, "Running");
  assert.equal(SCHEDULE_STATUSES.COMPLETED, "Completed");
  assert.equal(SCHEDULE_STATUSES.CANCELLED, "Cancelled");

  assert.ok(BUS_CATEGORIES.includes("AC"));
  assert.ok(BUS_CATEGORIES.includes("Non-AC"));
  assert.ok(BUS_CATEGORIES.includes("University Shuttle"));
});

test("saveBusRecord rejects invalid bus attributes before database write", async () => {
  // Missing or too short name
  await assert.rejects(
    saveBusRecord({ name: "A", registrationNumber: "CTG-1234", capacity: 40 }),
    (err) => err.code === "INVALID_BUS_NAME"
  );

  // Missing registration number
  await assert.rejects(
    saveBusRecord({ name: "Padma Express", registrationNumber: "", capacity: 40 }),
    (err) => err.code === "INVALID_REGISTRATION_NUMBER"
  );

  // Invalid capacity
  await assert.rejects(
    saveBusRecord({ name: "Padma Express", registrationNumber: "CTG-1234", capacity: 0 }),
    (err) => err.code === "INVALID_CAPACITY"
  );

  await assert.rejects(
    saveBusRecord({ name: "Padma Express", registrationNumber: "CTG-1234", capacity: 200 }),
    (err) => err.code === "INVALID_CAPACITY"
  );
});

test("updateBusOperationalStatus rejects unsupported status values", async () => {
  await assert.rejects(
    updateBusOperationalStatus("BUS-001", "Inactive"),
    (err) => err.code === "INVALID_STATUS"
  );
});

test("createScheduleRecord validates required fields and rejects past dates", async () => {
  // Missing bus
  await assert.rejects(
    createScheduleRecord({ busId: "", driverId: "drv", routeId: "CUET_STATION_DIRECT", departureTime: "05:45 AM", scheduleDate: "2026-12-01" }),
    (err) => err.code === "MISSING_BUS"
  );

  // Missing driver
  await assert.rejects(
    createScheduleRecord({ busId: "bus-1", driverId: "", routeId: "CUET_STATION_DIRECT", departureTime: "05:45 AM", scheduleDate: "2026-12-01" }),
    (err) => err.code === "MISSING_DRIVER"
  );

  // Missing route
  await assert.rejects(
    createScheduleRecord({ busId: "bus-1", driverId: "drv-1", routeId: "", departureTime: "05:45 AM", scheduleDate: "2026-12-01" }),
    (err) => err.code === "MISSING_ROUTE"
  );

  // Missing departure time
  await assert.rejects(
    createScheduleRecord({ busId: "bus-1", driverId: "drv-1", routeId: "CUET_STATION_DIRECT", departureTime: "", scheduleDate: "2026-12-01" }),
    (err) => err.code === "MISSING_DEPARTURE_TIME"
  );

  // Past date rejected
  await assert.rejects(
    createScheduleRecord({ busId: "bus-1", driverId: "drv-1", routeId: "CUET_STATION_DIRECT", departureTime: "05:45 AM", scheduleDate: "2020-01-01" }),
    (err) => err.code === "PAST_DATE_NOT_ALLOWED"
  );
});

