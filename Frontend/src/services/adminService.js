import { apiRequest } from "./api.js";

const scheduleTypes = ["Regular", "Weekend", "Holiday", "Exam", "Special Event"];

export async function getAdminBuses() {
  return (await apiRequest("/admin/transport/buses")).buses;
}

export async function saveBus(input) {
  return (await apiRequest("/admin/transport/buses", { method: "PUT", body: input })).bus;
}

export async function updateBusStatus(id, status) {
  return (await apiRequest(`/admin/transport/buses/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  })).bus;
}

export async function deleteBus(id) {
  return apiRequest(`/admin/transport/buses/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getAdminRoutes() {
  return (await apiRequest("/admin/transport/routes")).routes;
}

export async function getAdminSchedules(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.append("date", filters.date);
  if (filters.status && filters.status !== "All") params.append("status", filters.status);
  const query = params.toString() ? `?${params.toString()}` : "";
  return (await apiRequest(`/admin/transport/schedules${query}`)).schedules;
}

export async function createSchedule(input) {
  return (await apiRequest("/admin/transport/schedules", { method: "POST", body: input })).schedule;
}

export async function updateSchedule(id, input) {
  return (await apiRequest(`/admin/transport/schedules/${encodeURIComponent(id)}`, { method: "PUT", body: input })).schedule;
}

export async function saveSchedule(input) {
  const id = input.id || input.scheduleId;
  if (id) {
    return updateSchedule(id, input);
  }
  return createSchedule(input);
}

export async function cancelSchedule(id) {
  return (await apiRequest(`/admin/transport/schedules/${encodeURIComponent(id)}/cancel`, { method: "PATCH" })).schedule;
}

export async function deleteSchedule(id) {
  return apiRequest(`/admin/transport/schedules/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getAdminAssignments() {
  return (await apiRequest("/admin/transport/assignments")).assignments;
}

export async function saveAssignment(input) {
  return (await apiRequest("/admin/transport/assignments", { method: "PUT", body: input })).assignment;
}

export async function cancelAssignment(id) {
  return apiRequest(`/admin/transport/assignments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getAdminReservations(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.append("date", filters.date);
  if (filters.bus && filters.bus !== "All") params.append("bus", filters.bus);
  if (filters.route && filters.route !== "All") params.append("route", filters.route);
  if (filters.role && filters.role !== "All") params.append("role", filters.role);
  if (filters.status && filters.status !== "All") params.append("status", filters.status);
  if (filters.boardingStatus && filters.boardingStatus !== "All") params.append("boardingStatus", filters.boardingStatus);
  const query = params.toString() ? `?${params.toString()}` : "";
  return (await apiRequest(`/admin/transport/reservations${query}`)).reservations;
}

export async function updateAdminReservation(bookingId, updates) {
  return (await apiRequest(`/admin/transport/reservations/${encodeURIComponent(bookingId)}`, {
    method: "PUT",
    body: updates,
  })).reservation;
}

export async function getAdminUsers() {
  return (await apiRequest("/admin/transport/users")).users;
}

export async function updateUser(id, updates) {
  return (await apiRequest(`/admin/transport/users/${encodeURIComponent(id)}`, { method: "PUT", body: updates })).user;
}

export async function getAdminDrivers() {
  return (await apiRequest("/admin/transport/drivers")).drivers;
}

export async function updateDriver(id, updates) {
  return (await apiRequest(`/admin/transport/drivers/${encodeURIComponent(id)}`, { method: "PUT", body: updates })).driver;
}

export async function getMaintenanceRecords() {
  return (await apiRequest("/admin/transport/maintenance")).maintenance;
}

export async function updateMaintenance(id, updates) {
  return (await apiRequest(`/admin/transport/maintenance/${encodeURIComponent(id)}`, { method: "PUT", body: updates })).maintenance;
}

export async function getOperationalAlerts() {
  return (await apiRequest("/admin/transport/alerts")).alerts;
}

export async function getAdminOverview() {
  return (await apiRequest("/admin/transport/overview")).overview;
}

export async function getAnalytics() {
  return (await apiRequest("/admin/transport/analytics")).analytics;
}

export { scheduleTypes };
