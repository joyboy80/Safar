import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthPageShell from "../../components/auth/AuthPageShell";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { resetPassword } from "../../services/authService";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setToast } = useAuth();

  const urlParams = useMemo(() => {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(location.search);
    return {
      token: hash.get("access_token") || query.get("access_token") || "",
      email: query.get("email") || hash.get("email") || "",
      code: query.get("code") || query.get("otp") || "",
    };
  }, [location.hash, location.search]);

  const [useManualCode, setUseManualCode] = useState(!urlParams.token);
  const [email, setEmail] = useState(urlParams.email);
  const [otp, setOtp] = useState(urlParams.code);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (urlParams.email && !email) setEmail(urlParams.email);
    if (urlParams.code && !otp) setOtp(urlParams.code);
  }, [urlParams.email, urlParams.code, email, otp]);

  async function submit(event) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      return setError("Password and confirmation do not match.");
    }
    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }

    setLoading(true);
    setError("");
    try {
      if (urlParams.token && !useManualCode) {
        await resetPassword(urlParams.token, form.password, form.confirmPassword);
      } else {
        if (!email.trim()) return setError("Please enter your registered email address.");
        if (!otp.trim()) return setError("Please enter the 8-digit recovery code from your email.");
        await resetPassword({
          email: email.trim(),
          otp: otp.trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
        });
      }

      const message = "Password reset successful. Please sign in with your new password.";
      setToast({ type: "success", message });
      navigate("/login", { replace: true, state: { message } });
    } catch (requestError) {
      setError(requestError.message || "Failed to reset password. Please check your recovery code and try again.");
      setToast({ type: "error", message: requestError.message || "Failed to reset password." });
    } finally {
      setLoading(false);
    }
  }

  const isTokenMode = Boolean(urlParams.token) && !useManualCode;

  return (
    <AuthPageShell
      eyebrow="Secure recovery"
      title="Choose a new password"
      description="Use at least eight characters with uppercase, lowercase, and a number."
    >
      <form className="mx-auto mt-6 max-w-md space-y-4" onSubmit={submit}>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {!isTokenMode && (
          <>
            <label className="block">
              <span className="text-sm font-semibold">Registered email</span>
              <input
                className="focus-ring mt-1.5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@cuet.ac.bd or gmail"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">8-digit recovery code</span>
              <input
                className="focus-ring mt-1.5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm font-mono tracking-widest"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.trim())}
                placeholder="e.g. 35021769"
                maxLength={10}
                required
              />
              <span className="mt-1 block text-xs text-slate-500">
                Check your email for the 8-digit recovery code sent by SAFAR.
              </span>
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm font-semibold">New password</span>
          <input
            className="focus-ring mt-1.5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm"
            type="password"
            value={form.password}
            onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
            minLength={8}
            placeholder="At least 8 characters (A-Z, a-z, 0-9)"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Confirm new password</span>
          <input
            className="focus-ring mt-1.5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((c) => ({ ...c, confirmPassword: e.target.value }))}
            minLength={8}
            placeholder="Re-enter your new password"
            required
          />
        </label>

        <Button className="w-full mt-2" type="submit" loading={loading}>
          Set new password
        </Button>

        {urlParams.token && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setUseManualCode((prev) => !prev)}
              className="text-xs font-medium text-slate-600 hover:text-safar-teal underline"
            >
              {useManualCode ? "Use link token mode" : "Enter recovery code manually"}
            </button>
          </div>
        )}
      </form>

      <p className="mt-6 text-center text-sm">
        <Link className="font-semibold text-safar-teal" to="/forgot-password">
          Request another recovery link
        </Link>
        <span className="mx-2 text-slate-400">&bull;</span>
        <Link className="font-semibold text-slate-600 hover:text-slate-800" to="/login">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
