import {
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  requestPasswordReset,
  resetPassword as resetUserPassword,
  updateCurrentProfile,
} from "../services/authService.js";
import { issueRegistrationOtp, verifyRegistrationOtp } from "../services/otpService.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";
import { readBearerToken } from "../middleware/authMiddleware.js";
import { clearSessionCookies, publicSession, readSessionCookies, setSessionCookies } from "../utils/authCookies.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";
import {
  validateForgotPassword,
  validateLogin,
  validateOtpRequest,
  validateOtpVerification,
  validateProfileUpdate,
  validateRefresh,
  validateRegistration,
  validateResetPassword,
  validatePasswordChange,
} from "../validators/authValidator.js";

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(validateRegistration(req.body));
  const emailed = result.verification.delivery === "EMAIL";
  return sendSuccess(res, {
    status: 201,
    data: result,
    message: emailed
      ? "Registration started. Enter the code sent to your email."
      : "Registration started. Email delivery is not configured, so the development OTP was printed in the backend terminal.",
  });
});

export const sendOtp = asyncHandler(async (req, res) => {
  const result = await issueRegistrationOtp(validateOtpRequest(req.body).email);
  return sendSuccess(res, {
    data: result,
    message: result.delivery === "EMAIL"
      ? "A verification code was sent to your email."
      : "Email delivery is not configured, so the development OTP was printed in the backend terminal.",
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const input = validateOtpVerification(req.body);
  const result = await verifyRegistrationOtp(input.email, input.otp);
  return sendSuccess(res, {
    data: result,
    message: "Email verified. Registration completed.",
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(validateLogin(req.body));
  setSessionCookies(res, result.session, { remember: req.body.remember !== false });
  return sendSuccess(res, { data: { user: result.user, session: publicSession(result.session) }, message: "Login successful." });
});

export const logout = asyncHandler(async (req, res) => {
  const accessToken = readSessionCookies(req).accessToken || readBearerToken(req.headers.authorization);
  if (accessToken) await logoutUser(accessToken).catch(() => undefined);
  clearSessionCookies(res, { allPaths: true });
  return sendSuccess(res, { message: "Logout successful." });
});

export const me = asyncHandler(async (req, res) => sendSuccess(res, { data: { user: req.user } }));

export const getProfile = me;

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateCurrentProfile(req.user.authUserId, validateProfileUpdate(req.body));
  return sendSuccess(res, { data: { user }, message: "Profile updated." });
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "Please select an image file to upload as your profile picture.", "NO_FILE_UPLOADED");
  }

  const result = await uploadImageBuffer(req.file.buffer, {
    folder: "safar/avatars",
    publicId: `avatar_${req.user.authUserId}`,
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });

  const updatedUser = await updateCurrentProfile(req.user.authUserId, {
    profile_image: result.secure_url,
  });

  return sendSuccess(res, {
    data: { user: updatedUser },
    message: "Profile picture uploaded successfully.",
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const cookies = readSessionCookies(req);
  const tokenCandidate = cookies.refreshToken || req.body?.refreshToken || req.body?.refresh_token;
  if (!tokenCandidate) {
    clearSessionCookies(res);
    throw new AppError(401, "A refresh token is required.", "SESSION_EXPIRED");
  }
  let result;
  try {
    result = await refreshUserSession(tokenCandidate);
  } catch (error) {
    clearSessionCookies(res);
    throw new AppError(401, "Your session expired. Please sign in again.", "SESSION_EXPIRED");
  }
  setSessionCookies(res, result.session, { remember: cookies.remember !== false });
  return sendSuccess(res, { data: { user: result.user, session: publicSession(result.session) }, message: "Session refreshed." });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = validateForgotPassword(req.body);
  await requestPasswordReset(email);
  return sendSuccess(res, { message: "If an account exists for that email, a secure password-reset link has been sent." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const accessToken = readBearerToken(req.headers.authorization);
  if (!accessToken) throw new AppError(401, "A password-reset access token is required.", "INVALID_RESET_TOKEN");
  const { password } = validateResetPassword(req.body);
  await resetUserPassword(accessToken, password);
  return sendSuccess(res, { message: "Password reset successful. Sign in with the new password." });
});

export const changePassword = asyncHandler(async (req, res) => {
  const accessToken = readSessionCookies(req).accessToken || readBearerToken(req.headers.authorization);
  if (!accessToken) throw new AppError(401, "An access token is required.", "UNAUTHORIZED");
  const { password } = validatePasswordChange(req.body);
  await resetUserPassword(accessToken, password);
  return sendSuccess(res, { message: "Password updated successfully." });
});
