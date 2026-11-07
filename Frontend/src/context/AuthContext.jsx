import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    authService.restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored?.user) {
          setAuth(restored);
        } else if (restored?.expired) {
          setAuth(null);
          setToast({ type: "info", message: "Your session expired. Please sign in again." });
        } else {
          setAuth(null);
        }
      })
      .catch(() => {
        if (active) setAuth(null);
      })
      .finally(() => {
        if (active) setIsRestoring(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const showApiError = (event) => {
      setToast({ type: "error", message: event.detail?.message || "The backend request failed." });
    };
    window.addEventListener("safar:api-error", showApiError);
    return () => window.removeEventListener("safar:api-error", showApiError);
  }, []);

  useEffect(() => {
    const expire = () => {
      setAuth(null);
      setToast({ type: "info", message: "Your session expired. Please sign in again." });
    };
    window.addEventListener("safar:session-expired", expire);
    return () => window.removeEventListener("safar:session-expired", expire);
  }, []);

  const value = useMemo(
    () => ({
      user: auth?.user || null,
      token: null,
      isAuthenticated: Boolean(auth?.user),
      isRestoring,
      toast,
      setToast,
      updateUser(nextUserData) {
        setAuth((prev) => {
          if (!prev?.user) return prev;
          return {
            ...prev,
            user: { ...prev.user, ...nextUserData },
          };
        });
      },
      async login(credentials) {
        const nextAuth = await authService.login(credentials);
        setAuth(nextAuth);
        setToast({ type: "success", message: `Welcome to Safar, ${nextAuth.user.roleLabel}.` });
        return nextAuth;
      },
      async logout() {
        await authService.logout();
        setAuth(null);
        setToast({ type: "info", message: "You have been signed out." });
      },
    }),
    [auth, isRestoring, toast]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
