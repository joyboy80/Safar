import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AuthPageShell from "../../components/auth/AuthPageShell";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { sendOtp, verifyOtp } from "../../services/authService";

const inputClass = "focus-ring mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-center text-lg font-bold tracking-[0.35em] text-safar-ink";

export default function VerifyOtpPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setToast } = useAuth();
  const email = useMemo(() => params.get("email")?.trim() || "", [params]);
  const initialCooldown = location.state?.verification?.resendAfterSeconds || 0;
  const [seconds, setSeconds] = useState(initialCooldown);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function submit(event) {
    event.preventDefault();
    if (!email) return setError("Open this page from registration or provide an email in the link.");
    setLoading(true);
    setError("");
    try {
      const result = await verifyOtp(email, otp);
      const message = "Email verified. You can now sign in.";
      setToast({ type: "success", message });
      navigate("/login", { replace: true, state: { message } });
    } catch (requestError) {
      setError(requestError.message);
      setToast({ type: "error", message: requestError.message });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    try {
      const result = await sendOtp(email);
      setSeconds(result?.resendAfterSeconds || 60);
      setToast({ type: "success", message: "A new verification code was sent." });
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.code === "OTP_COOLDOWN" && requestError.details?.retryAfter) setSeconds(requestError.details.retryAfter);
      setToast({ type: "error", message: requestError.message });
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthPageShell eyebrow="Email verification" title="Enter your six-digit code" description={email ? `We sent a one-time code to ${email}.` : "Return to registration and enter your CUET email first."}>
      {error && <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      <form className="mx-auto mt-6 max-w-sm" onSubmit={submit}>
        <label className="block"><span className="text-sm font-semibold">Verification code</span><input className={inputClass} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></label>
        <Button className="mt-5 w-full" type="submit" loading={loading} disabled={otp.length !== 6}>Verify email</Button>
      </form>
      <div className="mt-5 text-center text-sm"><button className="font-semibold text-safar-teal disabled:text-safar-gray" type="button" disabled={!email || seconds > 0 || resending} onClick={resend}>{seconds > 0 ? `Resend in ${seconds}s` : resending ? "Sending…" : "Resend code"}</button></div>
      <p className="mt-5 text-center text-sm text-safar-gray"><Link className="font-semibold text-safar-teal" to="/login">Back to sign in</Link></p>
    </AuthPageShell>
  );
}
