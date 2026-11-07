import { Router } from "express";
import {
  getAdminAssignments, getAdminBuses, getAdminDrivers, getAdminReservations, getAdminRoutes, getAdminSchedules, getAdminUsers,
  getAlerts, getAnalytics, getOverview, putAdminBus, putAdminDriver, putAdminReservation, putAdminRoute,
  putAdminAssignment, putAdminSchedule, putAdminUser, removeAdminAssignment, removeAdminBus, removeAdminRoute, removeAdminSchedule,
  patchAdminBusStatus, postAdminSchedule, patchAdminScheduleCancel,
  getPredictionsOccupancy, getPredictionsInsights, getRecommendationsAllocations
} from "../controllers/transportController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import requireRole from "../middleware/requireRole.js";
import { ROLES } from "../validators/authValidator.js";
import {
  getAdminFeaturedPhotos,
  postAdminFeaturedPhoto,
  deleteAdminFeaturedPhoto,
} from "../controllers/busPhotoController.js";
import { uploadBusPhotoMiddleware } from "../middleware/uploadMiddleware.js";

const router = Router();
router.use(authMiddleware, requireRole(ROLES.TRANSPORT_ADMIN));
router.get("/buses", getAdminBuses);
router.post("/buses", putAdminBus);
router.put("/buses", putAdminBus);
router.patch("/buses/:id/status", patchAdminBusStatus);
router.delete("/buses/:id", removeAdminBus);
router.get("/routes", getAdminRoutes);
const routeMutationBlocked = (_req, res) => res.status(405).json({
  success: false,
  error: {
    code: "METHOD_NOT_ALLOWED",
    message: "Routes are predefined in the database and cannot be modified or deleted.",
  },
});
router.put("/routes", routeMutationBlocked);
router.delete("/routes/:id", routeMutationBlocked);
router.get("/schedules", getAdminSchedules);
router.post("/schedules", postAdminSchedule);
router.put("/schedules", putAdminSchedule);
router.put("/schedules/:id", putAdminSchedule);
router.patch("/schedules/:id/cancel", patchAdminScheduleCancel);
router.delete("/schedules/:id", removeAdminSchedule);
router.get("/assignments", getAdminAssignments);
router.put("/assignments", putAdminAssignment);
router.delete("/assignments/:id", removeAdminAssignment);
router.get("/reservations", getAdminReservations);
router.put("/reservations/:id", putAdminReservation);
router.get("/users", getAdminUsers);
router.put("/users/:id", putAdminUser);
router.get("/drivers", getAdminDrivers);
router.put("/drivers/:id", putAdminDriver);
router.get("/alerts", getAlerts);
router.get("/overview", getOverview);
router.get("/analytics", getAnalytics);

router.get("/featured-photos", getAdminFeaturedPhotos);
router.post("/featured-photos", uploadBusPhotoMiddleware, postAdminFeaturedPhoto);
router.delete("/featured-photos/:id", deleteAdminFeaturedPhoto);

router.get("/predictions/occupancy", getPredictionsOccupancy);
router.get("/predictions/insights", getPredictionsInsights);
router.get("/recommendations/allocations", getRecommendationsAllocations);

export default router;
