import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
  changePassword,
  sendOtp,
  updateProfile,
  uploadAvatar,
  verifyOtp,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadAvatarMiddleware } from "../middleware/uploadMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/send-otp", sendOtp);
router.post("/resend-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/password", authMiddleware, changePassword);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);
router.put("/profile", authMiddleware, updateProfile);
router.post("/profile/avatar", authMiddleware, uploadAvatarMiddleware, uploadAvatar);

export default router;
