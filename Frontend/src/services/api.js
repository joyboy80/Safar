const configuredUrl = import.meta.env.VITE_API_URL?.trim() || "/api";

export const API_BASE_URL = configuredUrl.replace(/\/$/, "");
let refreshRequest = null;

const TOKEN_KEY = "safar_access_token";
const REFRESH_KEY = "safar_refresh_token";

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredRefreshToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setStoredTokens({ accessToken, refreshToken } = {}) {
  if (typeof window === "undefined") return;
  try {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Ignore storage errors
  }
}

function notifyApiError(error) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("safar:api-error", { detail: error }));
  }
}

function notifySessionExpired() {
  clearStoredTokens();
  window.dispatchEvent(new Event("safar:session-expired"));
}

export function refreshSession() {
  const currentRefreshToken = getStoredRefreshToken();
  if (!currentRefreshToken) {
    clearStoredTokens();
    return Promise.resolve({ ok: false, status: 401 });
  }
  refreshRequest ||= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: currentRefreshToken || "" }),
  })
    .then(async (response) => {
      if (response.ok) {
        const payload = await response.clone().json().catch(() => null);
        const session = payload?.data?.session;
        if (session) {
          setStoredTokens({
            accessToken: session.accessToken || session.token,
            refreshToken: session.refreshToken || currentRefreshToken,
          });
        }
      } else {
        clearStoredTokens();
      }
      return response;
    })
    .catch((err) => {
      clearStoredTokens();
      throw err;
    })
    .finally(() => {
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
  const activeToken = token || getStoredToken();
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      method,
      signal,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
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
      const nextToken = getStoredToken();
      return apiRequest(path, { method, body, token: nextToken, signal, retryOnUnauthorized: false, silent });
    }
    if (!silent) {
      notifySessionExpired();
    }
  }

  let payload = null;
  let textBody = null;
  try {
    textBody = await response.text();
    payload = JSON.parse(textBody);
  } catch {
    // textBody contains unparsed text/html if not JSON
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
