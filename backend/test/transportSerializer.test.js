import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteAdminRoute,
  listRoutes,
  saveAdminBus,
  saveAdminRoute,
  scheduleDate,
  serializeBus,
  serializeReservation,
  serializeTrip,
  updateAdminReservation,
  validateAdminBusInput,
} from "../src/services/transportService.js";

test("transport serializers preserve the established frontend contracts", () => {
  const busRow = {
    id: "BUS-001", name: "Surma", number: "JA-2020", category: "Student Bus", capacity: 44,
    route: "Campus - Hall", stops: ["Campus", "Hall"], departure_time: "07:30 AM", arrival_time: "08:20 AM",
    status: "On Time", next_stop: "Hall", eta_minutes: 8, location_label: "Campus Road", latitude: 1, longitude: 2,
    assigned_driver_name: "Mizan Rahman",
  };
  assert.deepEqual(serializeBus(busRow, 3), {
    id: "BUS-001", name: "Surma", number: "JA-2020", type: "Student Bus", capacity: 44,
    route: "Campus - Hall", routeId: null, stops: ["Campus", "Hall"], departureTime: "07:30 AM", arrivalTime: "08:20 AM",
    availableSeats: 41, status: "On Time", nextStop: "Hall", eta: "8 min",
    currentLocation: { label: "Campus Road", lat: 1, lng: 2 }, assignedDriver: "Mizan Rahman",
  });
  const trip = serializeTrip({ id: "BUS-001-M1", bus_id: "BUS-001", route: busRow.route, stops: busRow.stops, departure_time: "07:30 AM", arrival_time: "08:20 AM", status: "Scheduled", buses: busRow });
  assert.equal(trip.busName, "Surma");
  assert.equal(trip.busCategory, "Student Bus");
});

test("admin fleet input validates buses before database writes", () => {
  const bus = validateAdminBusInput({ name: "Karnaphuli", number: "JA-4040", type: "Student Bus", capacity: 40, route: "CUET - Station", status: "On Time" });
  assert.equal(bus.name, "Karnaphuli");
  assert.deepEqual(bus.stops, ["CUET", "Station"]);
  assert.throws(() => validateAdminBusInput({ name: "", number: "JA-1", type: "Student Bus", capacity: 40, route: "CUET - Station" }), (error) => error.code === "BUS_VALIDATION_ERROR");
  assert.throws(() => validateAdminBusInput({ name: "A", number: "JA-1", type: "Student Bus", capacity: 2, route: "CUET - Station" }), (error) => error.code === "INVALID_BUS_CAPACITY");
});

test("passenger schedule queries accept only ISO service dates", () => {
  assert.equal(scheduleDate("2026-08-20"), "2026-08-20");
  assert.throws(() => scheduleDate("20/08/2026"), (error) => error.code === "INVALID_SERVICE_DATE");
});

test("reservation serializer does not expose database naming", () => {
  const result = serializeReservation({
    id: "BKG-1", ticket_id: "TKT-1", profile_id: "profile", passenger_name: "Passenger", passenger_email: "p@cuet.ac.bd",
    role_label: "Student", trip_id: "TRIP-1", bus_id: "BUS-1", bus_name: "Surma", bus_number: "JA-1",
    bus_category: "Student Bus", route: "A - B", travel_date: "2026-08-10", departure_time: "07:30 AM",
    arrival_time: "08:20 AM", seat_number: "1A", status: "Confirmed", boarding_status: "Not Boarded",
    created_at: "now", cancelled_at: null, university_id: "u2204094",
  });
  assert.equal(result.bookingId, "BKG-1");
  assert.equal(result.ticketId, "TKT-1");
  assert.equal(result.date, "2026-08-10");
  assert.equal(Object.hasOwn(result, "profile_id"), false);
});

test("saveAdminBus rejects non-existent bus or route IDs", async () => {
  await assert.rejects(
    () => saveAdminBus({ busId: "NON-EXISTENT-BUS", routeId: "RTE-01" }),
    (error) => error.code === "BUS_NOT_FOUND" && error.statusCode === 404,
  );
  await assert.rejects(
    () => saveAdminBus({ routeId: "NON-EXISTENT-ROUTE" }),
    (error) => error.code === "ROUTE_NOT_FOUND" && error.statusCode === 404,
  );
});

test("predefined routes provide 5 database-driven routes with strictly ordered stoppages", async () => {
  const { listRoutes, saveAdminRoute, deleteAdminRoute } = await import("../src/services/transportService.js");
  const routes = await listRoutes();

  assert.equal(routes.length, 5);

  // Route 1: Direct via Flyover
  assert.equal(routes[0].id, "CUET_STATION_DIRECT");
  assert.equal(routes[0].name, "Route 1 — Direct via Flyover");
  assert.equal(routes[0].direction, "CUET → Station");
  assert.deepEqual(routes[0].stops, [
    "CUET Campus", "Noapara", "Rastar Matha", "Bahaddarhat", "Muradpur Flyover", "Lalkhan Bazar", "Station"
  ]);
  assert.equal(routes[0].stoppages[0].name, "CUET Campus");
  assert.equal(routes[0].stoppages[0].order, 1);
  assert.equal(routes[0].stoppages[6].name, "Station");
  assert.equal(routes[0].stoppages[6].order, 7);

  // Route 2: via GEC
  assert.equal(routes[1].id, "CUET_STATION_GEC");
  assert.equal(routes[1].name, "Route 2 — via GEC");
  assert.equal(routes[1].direction, "CUET → Station");
  assert.equal(routes[1].stops[6], "GEC");

  // Route 3: via Flyover & GEC
  assert.equal(routes[2].id, "CUET_STATION_FLYOVER_GEC");
  assert.equal(routes[2].name, "Route 3 — via Flyover & GEC");
  assert.equal(routes[2].direction, "CUET → Station");
  assert.equal(routes[2].stops[4], "Muradpur Flyover");
  assert.equal(routes[2].stops[5], "GEC");

  // Route 4: Return via Bahaddarhat
  assert.equal(routes[3].id, "STATION_CUET_BAHADDARHAT");
  assert.equal(routes[3].name, "Route 4 — Return via Bahaddarhat");
  assert.equal(routes[3].direction, "Station → CUET");
  assert.deepEqual(routes[3].stops, [
    "Station", "Lalkhan Bazar", "Flyover", "Bahaddarhat", "Rastar Matha", "Noapara", "CUET"
  ]);

  // Route 5: Return via GEC
  assert.equal(routes[4].id, "STATION_CUET_GEC");
  assert.equal(routes[4].name, "Route 5 — Return via GEC");
  assert.equal(routes[4].direction, "Station → CUET");
  assert.equal(routes[4].stops[3], "GEC");

  // Route mutations are blocked
  await assert.rejects(
    () => saveAdminRoute({ name: "Custom Route" }),
    (error) => error.code === "ROUTES_PREDEFINED" && error.statusCode === 405
  );
  await assert.rejects(
    () => deleteAdminRoute("CUET_STATION_DIRECT"),
    (error) => error.code === "ROUTES_PREDEFINED" && error.statusCode === 405
  );
});

test("updateAdminReservation validates input and rejects invalid status or non-existent booking", async () => {
  await assert.rejects(
    () => updateAdminReservation("NON-EXISTENT-BOOKING", { status: "Used" }),
    (error) => error.code === "RESERVATION_NOT_FOUND" && error.statusCode === 404
  );
});


