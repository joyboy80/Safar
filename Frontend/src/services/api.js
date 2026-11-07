const configuredUrl = import.meta.env.VITE_API_URL?.trim() || "/api";

export const API_BASE_URL = configuredUrl.replace(/\/$/, "");
let refreshRequest = null;

function notifyApiError(error) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("safar:api-error", { detail: error }));
  }
}

function notifySessionExpired() {
  window.dispatchEvent(new Event("safar:session-expired"));
}

function refreshSession() {
  refreshRequest ||= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  }).finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

const NON_REFRESHABLE_AUTH_PATHS = [
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
  "/auth/verify-otp",
  "/auth/send-otp",
  "/auth/resend-otp",
  "/auth/forgot-password",
  "/auth/reset-password",
];

export async function apiRequest(path, { method = "GET", body, token, signal, retryOnUnauthorized = true, silent = false } = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      method,
      signal,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    if (cause?.code === "API_ERROR" || cause?.status) {
      throw cause;
    }
    const error = new Error("The SAFAR backend could not be reached.", { cause });
    error.code = "NETWORK_ERROR";
    if (!silent) {
      notifyApiError(error);
    }
    throw error;
  }

  const isExcludedFromRefresh = NON_REFRESHABLE_AUTH_PATHS.some((p) => normalizedPath.startsWith(p));
  if (response.status === 401 && retryOnUnauthorized && !isExcludedFromRefresh) {
    const refreshed = await refreshSession();
    if (refreshed?.ok) {
      return apiRequest(path, { method, body, token, signal, retryOnUnauthorized: false, silent });
    }
    if (!silent) {
      notifySessionExpired();
    }
  }

  let payload = null;
  let textBody = null;
  try {
    payload = await response.json();
  } catch (e) {
    textBody = await response.text().catch(() => null);
  }

  if (!response.ok) {
    let errorMessage = payload?.error?.message;
    if (!errorMessage && textBody) {
      errorMessage = `Server Error (${response.status}): ${textBody.slice(0, 100)}`;
    }
    const error = new Error(errorMessage || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.code = payload?.error?.code || "API_ERROR";
    error.details = payload?.error?.details;
    if (!silent) {
      notifyApiError(error);
    }
    throw error;
  }

  return payload?.data;
}
