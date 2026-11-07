import {
  adminAnalytics,
  adminAssignments,
  adminBuses,
  adminDrivers,
  adminOverview,
  adminSchedules,
  adminUsers,
  cancelReservation,
  cancelAdminAssignment,
  clearNotifications,
  createDriverReport,
  deleteAdminBus,
  deleteAdminRoute,
  deleteAdminSchedule,
  driverTrips,
  getTicket,
  listBuses,
  listNotifications,
  listReservations,
  listRoutes,
  listTickets,
  listTracking,
  listTrips,
  maintenanceRecords,
  markNotification,
  operationalAlerts,
  passengerManifest,
  reserveSeat,
  reservedSeats,
  saveAdminBus,
  saveAdminRoute,
  saveAdminSchedule,
  saveAdminAssignment,
  tripSummary,
  updateAdminDriver,
  updateAdminReservation,
  updateAdminUser,
  updateDriverLocation,
  updateDriverTrip,
  updateMaintenance,
  verifyDriverTicket,
} from "../services/transportService.js";
import {
  listAllBuses,
  saveBusRecord,
  updateBusOperationalStatus,
  removeBusRecord,
  listAllSchedules,
  createScheduleRecord,
  updateScheduleRecord,
  cancelScheduleRecord,
  deleteScheduleRecord,
  getDriverSchedules,
  driverStartScheduleTrip,
  driverCompleteScheduleTrip,
  getUserDashboardSchedules,
} from "../services/fleetScheduleService.js";
import { getOccupancyPredictions, getSmartTransportationInsights } from "../services/predictionService.js";
import { getBusAllocationRecommendations } from "../services/recommendationService.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

function text(value, label, { optional = false } = {}) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result && !optional) throw new AppError(400, `${label} is required.`, "VALIDATION_ERROR");
  return result;
}

function reservationInput(body = {}) {
  const tripId = text(body.tripId, "Trip");
  const date = text(body.date, "Travel date");
  const seatNumber = text(body.seatNumber, "Seat").toUpperCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "Travel date is invalid.", "INVALID_TRAVEL_DATE");
  if (!/^[1-9][0-9]?[A-D]$/.test(seatNumber)) throw new AppError(400, "Seat number is invalid.", "INVALID_SEAT");
  return { tripId, date, seatNumber };
}

export const buses = asyncHandler(async (req, res) => {
  const [scheduledBuses, baseBuses] = await Promise.all([
    getUserDashboardSchedules(req.user, req.query.date).catch(() => []),
    listBuses(req.user, undefined, req.query.date).catch(() => []),
  ]);
  const combined = [
    ...scheduledBuses,
    ...baseBuses.filter((b) => !scheduledBuses.some((sb) => sb.busId === b.id || sb.id === b.id)),
  ];
  return sendSuccess(res, { data: { buses: combined } });
});
export const bus = asyncHandler(async (req, res) => {
  const result = await listBuses(req.user, req.params.id, req.query.date);
  if (!result) throw new AppError(404, "Bus not found or unavailable for this role.", "BUS_NOT_FOUND");
  return sendSuccess(res, { data: { bus: result } });
});
export const routes = asyncHandler(async (_req, res) => sendSuccess(res, { data: { routes: await listRoutes() } }));
export const trips = asyncHandler(async (req, res) => sendSuccess(res, { data: { trips: await listTrips(req.user, req.query.date) } }));
export const reservations = asyncHandler(async (req, res) => sendSuccess(res, { data: { reservations: await listReservations(req.user.profileId) } }));
export const seats = asyncHandler(async (req, res) => sendSuccess(res, { data: { seats: await reservedSeats(req.user, text(req.query.tripId, "Trip"), text(req.query.date, "Travel date")) } }));
export const createReservation = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, data: await reserveSeat(req.user.profileId, reservationInput(req.body)), message: "Reservation confirmed." }));
export const removeReservation = asyncHandler(async (req, res) => sendSuccess(res, { data: { reservation: await cancelReservation(req.user.profileId, req.params.id) }, message: "Reservation cancelled." }));
export const tickets = asyncHandler(async (req, res) => sendSuccess(res, { data: { tickets: await listTickets(req.user) } }));
export const ticket = asyncHandler(async (req, res) => {
  const result = await getTicket(req.user, req.params.id);
  if (!result) throw new AppError(404, "Ticket not found.", "TICKET_NOT_FOUND");
  return sendSuccess(res, { data: { ticket: result } });
});
export const downloadTicket = asyncHandler(async (req, res) => {
  const result = await getTicket(req.user, req.params.id);
  if (!result) throw new AppError(404, "Ticket not found.", "TICKET_NOT_FOUND");
  
  // Format ticket as a downloadable text receipt
  const receipt = `
========================================
             SAFAR TICKET              
========================================
Ticket ID:      ${result.id}
Status:         ${result.status}
Issue Date:     ${new Date().toLocaleString()}
----------------------------------------
Passenger:      ${req.user.fullName}
Role:           ${req.user.role}
----------------------------------------
Travel Date:    ${result.date}
Bus:            ${result.busName} (${result.busNumber})
Route:          ${result.route}
Departure:      ${result.departureTime}
Seat:           ${result.seatNumber}
========================================
Scan the QR code at the bus to board.
  `;
  
  res.setHeader("Content-Disposition", `attachment; filename="safar-ticket-${result.id}.txt"`);
  res.setHeader("Content-Type", "text/plain");
  return res.send(receipt.trim());
});

export const downloadInvoice = asyncHandler(async (req, res) => {
  const result = await getTicket(req.user, req.params.id);
  if (!result) throw new AppError(404, "Ticket not found.", "TICKET_NOT_FOUND");
  if (!result.invoice) throw new AppError(404, "Invoice not found for this ticket.", "INVOICE_NOT_FOUND");

  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader("Content-Disposition", `attachment; filename="invoice-${result.invoice.invoiceNumber}.pdf"`);
  res.setHeader("Content-Type", "application/pdf");
  
  doc.pipe(res);
  
  // Header
  doc.fontSize(24).font('Helvetica-Bold').text("SAFAR", { align: 'left' });
  doc.fontSize(10).font('Helvetica').text("Chittagong University of Engineering & Technology", { align: 'left' });
  doc.text("Pahartali, Raozan, Chattogram-4349", { align: 'left' });
  
  doc.moveUp(3);
  doc.fontSize(20).font('Helvetica-Bold').text("INVOICE", { align: 'right' });
  doc.fontSize(10).font('Helvetica').text(`Invoice No: ${result.invoice.invoiceNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(result.invoice.issueDate).toLocaleDateString()}`, { align: 'right' });
  
  doc.moveDown(3);
  
  // Passenger Info
  doc.fontSize(12).font('Helvetica-Bold').text("Billed To:");
  doc.fontSize(10).font('Helvetica').text(`Name: ${result.passengerName}`);
  doc.text(`Role: ${result.roleLabel}`);
  if (result.universityId) doc.text(`ID: ${result.universityId}`);
  doc.text(`Email: ${result.email}`);
  
  doc.moveUp(4);
  doc.fontSize(12).font('Helvetica-Bold').text("Booking Details:", { align: 'right' });
  doc.fontSize(10).font('Helvetica').text(`Booking ID: ${result.bookingId}`, { align: 'right' });
  doc.text(`Ticket ID: ${result.ticketId}`, { align: 'right' });
  doc.text(`Status: ${result.invoice.paymentStatus}`, { align: 'right' });
  
  doc.moveDown(3);
  
  // Trip Details Table
  const tableTop = 330;
  doc.font('Helvetica-Bold').text("Trip Information", 50, tableTop - 20);
  
  // Draw table line
  doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();
  
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text("Bus", 50, tableTop + 10);
  doc.text("Route", 200, tableTop + 10);
  doc.text("Date", 350, tableTop + 10);
  doc.text("Time", 420, tableTop + 10);
  doc.text("Seat", 500, tableTop + 10);
  
  doc.moveTo(50, tableTop + 30).lineTo(550, tableTop + 30).stroke();
  
  doc.font('Helvetica').fontSize(10);
  doc.text(result.busName, 50, tableTop + 40, { width: 140 });
  doc.text(result.route, 200, tableTop + 40, { width: 140 });
  doc.text(result.date, 350, tableTop + 40);
  doc.text(result.departureTime, 420, tableTop + 40);
  doc.text(result.seatNumber, 500, tableTop + 40);
  
  doc.moveTo(50, tableTop + 70).lineTo(550, tableTop + 70).stroke();
  
  // Payment Summary
  const summaryTop = tableTop + 100;
  doc.font('Helvetica-Bold').text("Payment Summary", 50, summaryTop - 20);
  
  doc.moveTo(50, summaryTop).lineTo(550, summaryTop).stroke();
  
  doc.font('Helvetica-Bold');
  doc.text("Description", 50, summaryTop + 10);
  doc.text("Qty", 350, summaryTop + 10, { align: 'right' });
  doc.text("Amount", 450, summaryTop + 10, { align: 'right' });
  
  doc.moveTo(50, summaryTop + 30).lineTo(550, summaryTop + 30).stroke();
  
  doc.font('Helvetica');
  doc.text("Transport Ticket", 50, summaryTop + 40);
  doc.text("1", 350, summaryTop + 40, { align: 'right' });
  doc.text(`${result.invoice.subtotal.toFixed(2)} ${result.invoice.currency}`, 450, summaryTop + 40, { align: 'right' });
  
  doc.moveTo(350, summaryTop + 60).lineTo(550, summaryTop + 60).stroke();
  
  doc.font('Helvetica-Bold');
  doc.text("Total:", 350, summaryTop + 70, { align: 'right' });
  doc.text(`${result.invoice.total.toFixed(2)} ${result.invoice.currency}`, 450, summaryTop + 70, { align: 'right' });
  
  // Footer
  doc.fontSize(10).font('Helvetica').text(
    "Thank you for using Safar! Keep this invoice for your records.", 
    50, 
    700, 
    { align: 'center', width: 500 }
  );
  
  doc.end();
});
export const shareTicket = asyncHandler(async (req, res) => {
  const result = await getTicket(req.user, req.params.id);
  if (!result) throw new AppError(404, "Ticket not found.", "TICKET_NOT_FOUND");
  
  // Return a mock shareable link
  const shareLink = `https://safar.app/verify/${result.id}`;
  return sendSuccess(res, { data: { link: shareLink }, message: "Share link generated successfully." });
});
export const tracking = asyncHandler(async (req, res) => sendSuccess(res, { data: { buses: await listTracking(req.user) } }));
export const trackingBus = asyncHandler(async (req, res) => sendSuccess(res, { data: { bus: (await listTracking(req.user, req.params.id))[0] || null } }));
export const serviceStatus = asyncHandler(async (_req, res) => {
  const [maintenance, alerts] = await Promise.all([maintenanceRecords(), operationalAlerts()]);
  return sendSuccess(res, { data: { maintenance, alerts: { conditions: alerts.conditions, delays: alerts.delays, emergencies: [] } } });
});
export const notifications = asyncHandler(async (req, res) => sendSuccess(res, { data: { notifications: await listNotifications(req.user) } }));
export const readNotification = asyncHandler(async (req, res) => sendSuccess(res, { data: { notifications: await markNotification(req.user, req.params.id) } }));
export const readAllNotifications = asyncHandler(async (req, res) => sendSuccess(res, { data: { notifications: await markNotification(req.user) } }));
export const removeNotifications = asyncHandler(async (req, res) => sendSuccess(res, { data: { notifications: await clearNotifications(req.user) } }));

export const assignedTrips = asyncHandler(async (req, res) => {
  const driverId = req.user.authUserId || req.user.id || req.user.profileId;
  const [schedules, legacy] = await Promise.all([
    getDriverSchedules(driverId).catch(() => []),
    driverTrips(req.user).catch(() => []),
  ]);
  const formattedSchedules = schedules.map((s) => ({
    id: s.id,
    tripId: s.id,
    scheduleId: s.id,
    busId: s.busId,
    busName: s.busName,
    busNumber: s.registrationNumber,
    registrationNumber: s.registrationNumber,
    busCategory: s.busCategory,
    route: s.routeName,
    routeName: s.routeName,
    routeDirection: s.routeDirection,
    departureTime: s.departureTime,
    scheduleDate: s.scheduleDate,
    status: s.scheduleStatus === "Running" ? "In Progress"
      : s.scheduleStatus === "Completed" ? "Completed"
      : s.scheduleStatus === "Cancelled" ? "Cancelled"
      : "Upcoming",
    scheduleStatus: s.scheduleStatus,
    capacity: s.capacity,
    stops: s.stops || [],
  }));
  const combined = [...formattedSchedules, ...legacy.filter((l) => !formattedSchedules.some((f) => f.id === l.id))];
  return sendSuccess(res, { data: { trips: combined } });
});
export const manifest = asyncHandler(async (req, res) => sendSuccess(res, { data: { passengers: await passengerManifest(req.user, req.params.id) } }));
export const summary = asyncHandler(async (req, res) => sendSuccess(res, { data: { summary: await tripSummary(req.user, req.params.id) } }));
export const changeTripStatus = asyncHandler(async (req, res) => {
  const status = text(req.body.status, "Trip status");
  const normalized = status === "Running" ? "In Progress" : status;
  if (!["Upcoming", "Boarding", "In Progress", "Completed", "Cancelled"].includes(normalized)) {
    throw new AppError(400, "Unsupported trip status.", "INVALID_TRIP_STATUS");
  }

  const driverId = req.user.authUserId || req.user.id || req.user.profileId;
  let scheduleTrip = null;

  if (normalized === "In Progress") {
    try {
      scheduleTrip = await driverStartScheduleTrip(driverId, req.params.id);
    } catch {
      // not a fleet schedule or fallback
    }
  } else if (normalized === "Completed") {
    try {
      scheduleTrip = await driverCompleteScheduleTrip(driverId, req.params.id);
    } catch {
      // not a fleet schedule or fallback
    }
  }

  if (scheduleTrip) {
    return sendSuccess(res, { data: { trip: scheduleTrip } });
  }

  return sendSuccess(res, { data: { trip: await updateDriverTrip(req.user, req.params.id, normalized) } });
});
export const publishLocation = asyncHandler(async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AppError(400, "A valid GPS coordinate is required.", "INVALID_LOCATION");
  }
  const location = await updateDriverLocation(req.user, { ...req.body, tripId: text(req.body.tripId, "Trip"), latitude, longitude });
  return sendSuccess(res, { data: { location } });
});
export const scanTicket = asyncHandler(async (req, res) => sendSuccess(res, { data: { ticket: await verifyDriverTicket(req.user, text(req.body.ticketId, "Ticket"), text(req.body.tripId, "Trip")) } }));
export const conditionReport = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, data: { report: await createDriverReport(req.user, "CONDITION", req.body) } }));
export const delayReport = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, data: { report: await createDriverReport(req.user, "DELAY", req.body) } }));
export const emergencyReport = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, data: { report: await createDriverReport(req.user, "EMERGENCY", req.body) } }));

export const getAdminBuses = asyncHandler(async (_req, res) => {
  const fleet = await listAllBuses();
  return sendSuccess(res, { data: { buses: fleet } });
});
export const putAdminBus = asyncHandler(async (req, res) => {
  const bus = await saveBusRecord(req.body);
  return sendSuccess(res, { data: { bus }, message: "Bus saved successfully." });
});
export const patchAdminBusStatus = asyncHandler(async (req, res) => {
  const status = text(req.body.status, "Operational status");
  const bus = await updateBusOperationalStatus(req.params.id, status);
  return sendSuccess(res, { data: { bus }, message: "Bus status updated." });
});
export const removeAdminBus = asyncHandler(async (req, res) => {
  await removeBusRecord(req.params.id);
  return sendSuccess(res, { message: "Bus deleted." });
});
export const getAdminRoutes = asyncHandler(async (_req, res) => {
  const admin = getSupabaseAdmin();
  const { data: allDbRoutes } = await admin.from("transport_routes").select("*").order("name");
  let combined = [];
  if (allDbRoutes && allDbRoutes.length > 0) {
    const seen = new Set();
    combined = allDbRoutes
      .filter((r) => {
        if (!r.name || seen.has(r.name.trim().toLowerCase())) return false;
        seen.add(r.name.trim().toLowerCase());
        return true;
      })
      .map((r) => ({
        id: r.id,
        name: r.name,
        routeName: r.name,
        direction: r.direction || "CUET ↔ Station",
        stops: r.stops || [],
      }));
  } else {
    combined = await listRoutes();
  }
  return sendSuccess(res, { data: { routes: combined } });
});
export const putAdminRoute = asyncHandler(async (req, res) => sendSuccess(res, { data: { route: await saveAdminRoute(req.body) } }));
export const removeAdminRoute = asyncHandler(async (req, res) => { await deleteAdminRoute(req.params.id); return sendSuccess(res, { message: "Route deleted." }); });
export const getAdminSchedules = asyncHandler(async (req, res) => {
  const { date, status } = req.query;
  const schedules = await listAllSchedules({ date, status });
  return sendSuccess(res, { data: { schedules } });
});
export const postAdminSchedule = asyncHandler(async (req, res) => {
  const schedule = await createScheduleRecord(req.body, req.user);
  return sendSuccess(res, { status: 201, data: { schedule }, message: "Bus schedule created successfully." });
});
export const putAdminSchedule = asyncHandler(async (req, res) => {
  const scheduleId = req.params.id || req.body.id || req.body.scheduleId;
  let schedule;
  if (scheduleId) {
    schedule = await updateScheduleRecord(scheduleId, req.body, req.user);
  } else {
    schedule = await createScheduleRecord(req.body, req.user);
  }
  return sendSuccess(res, { data: { schedule }, message: "Bus schedule saved successfully." });
});
export const patchAdminScheduleCancel = asyncHandler(async (req, res) => {
  const schedule = await cancelScheduleRecord(req.params.id, req.user);
  return sendSuccess(res, { data: { schedule }, message: "Schedule cancelled." });
});
export const removeAdminSchedule = asyncHandler(async (req, res) => {
  await deleteScheduleRecord(req.params.id);
  return sendSuccess(res, { message: "Schedule deleted." });
});
export const getAdminAssignments = asyncHandler(async (_req, res) => sendSuccess(res, { data: { assignments: await adminAssignments() } }));
export const putAdminAssignment = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, data: { assignment: await saveAdminAssignment(req.body) } }));
export const removeAdminAssignment = asyncHandler(async (req, res) => { await cancelAdminAssignment(req.params.id); return sendSuccess(res, { message: "Assignment cancelled." }); });
export const getAdminReservations = asyncHandler(async (req, res) => {
  const { date, busId, bus, routeId, route, role, status, boardingStatus } = req.query;
  const reservations = await listReservations(null, {
    all: true,
    date,
    busId,
    busName: bus,
    routeId,
    route,
    role,
    status,
    boardingStatus,
  });
  return sendSuccess(res, { data: { reservations } });
});
export const putAdminReservation = asyncHandler(async (req, res) => sendSuccess(res, { data: { reservation: await updateAdminReservation(req.params.id, req.body) } }));
export const getAdminUsers = asyncHandler(async (_req, res) => sendSuccess(res, { data: { users: await adminUsers() } }));
export const putAdminUser = asyncHandler(async (req, res) => sendSuccess(res, { data: { user: await updateAdminUser(req.params.id, req.body) } }));
export const getAdminDrivers = asyncHandler(async (_req, res) => sendSuccess(res, { data: { drivers: await adminDrivers() } }));
export const putAdminDriver = asyncHandler(async (req, res) => sendSuccess(res, { data: { driver: await updateAdminDriver(req.params.id, req.body) } }));
export const getMaintenance = asyncHandler(async (_req, res) => sendSuccess(res, { data: { maintenance: await maintenanceRecords() } }));
export const putMaintenance = asyncHandler(async (req, res) => sendSuccess(res, { data: { maintenance: await updateMaintenance(req.params.id, req.body) } }));
export const getAlerts = asyncHandler(async (_req, res) => sendSuccess(res, { data: { alerts: await operationalAlerts() } }));
export const getOverview = asyncHandler(async (_req, res) => {
  const [fleetBuses, fleetSchedules, baseOverview] = await Promise.all([
    listAllBuses().catch(() => []),
    listAllSchedules().catch(() => []),
    adminOverview().catch(() => ({ stats: {} })),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const activeBuses = fleetBuses.filter((b) => (b.operationalStatus || b.status) === "Online" || (b.operationalStatus || b.status) === "Running");
  const maintenanceBuses = fleetBuses.filter((b) => (b.operationalStatus || b.status) === "Maintenance");
  const todayTrips = fleetSchedules.filter((s) => s.scheduleDate === today && s.scheduleStatus !== "Cancelled");

  const mergedOverview = {
    ...baseOverview,
    buses: fleetBuses.map((b) => ({
      id: b.id,
      name: b.name || b.busName,
      number: b.number || b.registrationNumber,
      category: b.category,
      capacity: b.capacity,
      status: b.operationalStatus || b.status || "Online",
      currentLocation: { label: "CUET Transport Yard", lat: 22.4633, lng: 91.9745 },
    })),
    schedules: fleetSchedules.map((s) => ({
      id: s.id,
      busName: s.busName,
      departureTime: s.departureTime,
      route: s.routeName,
      date: s.scheduleDate,
      status: s.scheduleStatus,
    })),
    stats: {
      ...baseOverview.stats,
      totalBuses: fleetBuses.length,
      activeBuses: activeBuses.length,
      todayTrips: todayTrips.length,
      maintenanceBuses: maintenanceBuses.length,
    },
  };

  return sendSuccess(res, { data: { overview: mergedOverview } });
});
export const getAnalytics = asyncHandler(async (_req, res) => sendSuccess(res, { data: { analytics: await adminAnalytics() } }));

export const getPredictionsOccupancy = asyncHandler(async (_req, res) => sendSuccess(res, { data: { predictions: await getOccupancyPredictions() } }));
export const getPredictionsInsights = asyncHandler(async (_req, res) => sendSuccess(res, { data: { insights: await getSmartTransportationInsights() } }));
export const getRecommendationsAllocations = asyncHandler(async (_req, res) => sendSuccess(res, { data: { allocations: await getBusAllocationRecommendations() } }));
