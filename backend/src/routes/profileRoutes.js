import { Router } from "express";
import { getProfile, updateProfile, uploadAvatar } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadAvatarMiddleware } from "../middleware/uploadMiddleware.js";

const router = Router();
router.use(authMiddleware);
router.get("/", getProfile);
router.put("/", updateProfile);
router.post("/avatar", uploadAvatarMiddleware, uploadAvatar);

export default router;
