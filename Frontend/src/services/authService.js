import { getDashboardForRole, ROLE_LABELS, ROLES } from "../utils/roles.js";
import {
  apiRequest,
  clearStoredTokens,
  getStoredRefreshToken,
  getStoredToken,
  setStoredTokens,
} from "./api.js";

function normalizeRole(profile) {
  const value = String(profile?.role || profile?.userType || "").toLowerCase();
  return value === "transport_admin" ? ROLES.ADMIN : value;
}

function makeUser(profile) {
  const role = normalizeRole(profile);
  const universityId = profile.studentId || profile.employeeId || profile.institutionalId || profile.id;
  return {
    id: profile.id,
    authUserId: profile.authUserId,
    universityId,
    name: profile.fullName || profile.name,
    email: profile.email,
    phone: profile.phone,
    role,
    roleLabel: ROLE_LABELS[role],
    gender: profile.gender,
    batch: profile.batch,
    department: profile.department,
    departmentCode: profile.departmentCode,
    studentId: profile.studentId,
    profileImage: profile.profileImage,
    preferences: profile.preferences || { email: true, push: true },
    destination: getDashboardForRole(role),
  };
}

function makeAuthState({ profile, session, remember }) {
  return {
    user: makeUser(profile),
    expiresAt: session?.expiresAt,
    remember: Boolean(remember),
  };
}

export async function login(credentials) {
  if (!credentials.identifier || !credentials.password) throw new Error("Enter your university email and password.");

  const remember = credentials.remember !== false;
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: credentials.identifier, password: credentials.password, remember },
  });
  if (typeof window !== "undefined") {
    localStorage.removeItem("safar_logged_out");
  }
  if (result?.session?.accessToken || result?.session?.token) {
    setStoredTokens({
      accessToken: result.session.accessToken || result.session.token,
      refreshToken: result.session.refreshToken,
    });
  }
  return makeAuthState({ profile: result.user, session: result.session, remember });
}

export async function register(input) {
  const result = await apiRequest("/auth/register", { method: "POST", body: input });
  if (typeof window !== "undefined") {
    localStorage.removeItem("safar_logged_out");
  }
  if (result?.session?.accessToken || result?.session?.token) {
    setStoredTokens({
      accessToken: result.session.accessToken || result.session.token,
      refreshToken: result.session.refreshToken,
    });
  }
  if (!result.session) return result;
  const authState = makeAuthState({ profile: result.user, session: result.session, remember: true });
  return { ...result, authState };
}

export async function sendOtp(email) {
  return apiRequest("/auth/send-otp", { method: "POST", body: { email } });
}

export async function verifyOtp(email, otp) {
  return apiRequest("/auth/verify-otp", { method: "POST", body: { email, otp } });
}

export async function forgotPassword(email) {
  return apiRequest("/auth/forgot-password", { method: "POST", body: { email } });
}

export async function resetPassword(accessToken, password, confirmPassword) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    token: accessToken,
    body: { password, confirmPassword },
  });
}

export async function refresh() {
  const currentRefreshToken = getStoredRefreshToken();
  const result = await apiRequest("/auth/refresh", {
    method: "POST",
    body: { refreshToken: currentRefreshToken || "" },
  });
  if (result?.session?.accessToken || result?.session?.token) {
    setStoredTokens({
      accessToken: result.session.accessToken || result.session.token,
      refreshToken: result.session.refreshToken || currentRefreshToken,
    });
  }
  return makeAuthState({ profile: result.user, session: result.session, remember: true });
}

export async function restoreSession() {
  if (typeof window !== "undefined" && localStorage.getItem("safar_logged_out") === "true") {
    return null;
  }
  const token = getStoredToken();
  const refreshToken = getStoredRefreshToken();
  try {
    const result = await apiRequest("/auth/me", { silent: true });
    if (result?.user) {
      return { user: makeUser(result.user) };
    }
  } catch (error) {
    if (error?.status === 401) {
      if (refreshToken) {
        try {
          const refreshResult = await apiRequest("/auth/refresh", {
            method: "POST",
            body: { refreshToken },
            silent: true,
            retryOnUnauthorized: false,
          });
          if (refreshResult?.session?.accessToken || refreshResult?.session?.token) {
            setStoredTokens({
              accessToken: refreshResult.session.accessToken || refreshResult.session.token,
              refreshToken: refreshResult.session.refreshToken || refreshToken,
            });
          }
          if (refreshResult?.user) {
            return { user: makeUser(refreshResult.user) };
          }
        } catch {
          clearStoredTokens();
          return null;
        }
      }
      clearStoredTokens();
      if (error?.code === "SESSION_EXPIRED") {
        return { expired: true };
      }
      return null;
    }
    return null;
  }
  return null;
}

export async function getCurrentUser() {
  const result = await apiRequest("/auth/me");
  return makeUser(result.user);
}

export async function updateProfile(updates) {
  return apiRequest("/auth/profile", { method: "PUT", body: updates });
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const result = await apiRequest("/profile/avatar", {
    method: "POST",
    body: formData,
  });
  return result?.user ? makeUser(result.user) : result;
}

export async function logout() {
  if (typeof window !== "undefined") {
    localStorage.setItem("safar_logged_out", "true");
  }
  clearStoredTokens();
  await apiRequest("/auth/logout", { method: "POST", silent: true });
}

export async function changePassword(password, confirmPassword) {
  return apiRequest("/auth/password", {
    method: "PUT",
    body: { password, confirmPassword },
  });
}
