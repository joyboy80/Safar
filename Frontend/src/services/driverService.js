import { apiRequest } from "./api.js";

export async function getAssignedTrips() {
  return (await apiRequest("/driver/transport/trips")).trips;
}

export async function getCurrentTrip() {
  const trips = await getAssignedTrips();
  return trips.find((trip) => trip.status === "In Progress")
    || trips.find((trip) => trip.status === "Boarding")
    || trips.find((trip) => trip.status === "Upcoming")
    || trips[0]
    || null;
}

export async function getPassengerManifest(tripId) {
  return (await apiRequest(`/driver/transport/trips/${encodeURIComponent(tripId)}/passengers`)).passengers;
}

export async function getTripSummary(tripId) {
  return (await apiRequest(`/driver/transport/trips/${encodeURIComponent(tripId)}/summary`)).summary;
}

export async function verifyTicket(ticketId, currentTripId) {
  return (await apiRequest("/driver/transport/tickets/verify", { method: "POST", body: { ticketId, tripId: currentTripId } })).ticket;
}

export async function updateTripStatus(tripId, status) {
  const allowed = ["Upcoming", "Boarding", "In Progress", "Completed", "Cancelled"];
  if (!allowed.includes(status)) throw new Error("Unsupported trip status.");
  return (await apiRequest(`/driver/transport/trips/${encodeURIComponent(tripId)}/status`, { method: "PATCH", body: { status } })).trip;
}

export async function submitConditionReport(report) {
  return (await apiRequest("/driver/transport/reports/condition", { method: "POST", body: report })).report;
}

export async function submitDelayReport(report) {
  return (await apiRequest("/driver/transport/reports/delay", { method: "POST", body: report })).report;
}

export async function sendEmergencyAlert(alert) {
  return (await apiRequest("/driver/transport/reports/emergency", { method: "POST", body: alert })).report;
}
