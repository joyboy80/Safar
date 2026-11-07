import { Router } from "express";
import {
  bus, buses, createReservation, notifications, readAllNotifications, readNotification, removeNotifications,
  removeReservation, reservations, routes, seats, serviceStatus, ticket, tickets, tracking, trackingBus, trips,
  downloadTicket, downloadInvoice, shareTicket,
} from "../controllers/transportController.js";
import { getFeaturedPhotos } from "../controllers/busPhotoController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/requireRole.js";
import { ROLES } from "../validators/authValidator.js";

const router = Router();
router.use(authMiddleware);
router.get("/buses", buses);
router.get("/buses/:id", bus);
router.get("/routes", routes);
router.get("/trips", trips);
router.get("/tracking", tracking);
router.get("/tracking/:id", trackingBus);
router.get("/status", serviceStatus);
router.get("/featured-photos", getFeaturedPhotos);
router.get("/notifications", notifications);
router.patch("/notifications/read-all", readAllNotifications);
router.patch("/notifications/:id/read", readNotification);
router.delete("/notifications", removeNotifications);
router.use(requireRole(ROLES.STUDENT, ROLES.TEACHER, ROLES.STAFF));
router.get("/reservations", reservations);
router.get("/reservations/seats", seats);
router.post("/reservations", createReservation);
router.delete("/reservations/:id", removeReservation);
router.get("/tickets", tickets);
router.get("/tickets/:id", ticket);
router.get("/tickets/:id/download", downloadTicket);
router.get("/tickets/:id/invoice", downloadInvoice);
router.post("/tickets/:id/share", shareTicket);
export default router;
