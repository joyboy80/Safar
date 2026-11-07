import { useState } from "react";
import { Link } from "react-router-dom";
import AuthPageShell from "../../components/auth/AuthPageShell";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { forgotPassword } from "../../services/authService";

export default function ForgotPasswordPage() {
  const { setToast } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await forgotPassword(email);
      setSent(true);
      setToast({ type: "success", message: "If the account exists, a recovery link and code have been sent." });
    } catch (requestError) {
      setError(requestError.message);
      setToast({ type: "error", message: requestError.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your registered email and we’ll send a secure recovery link and code."
    >
      {sent ? (
        <div className="mx-auto mt-6 max-w-md space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm text-emerald-900 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Recovery instructions sent!</span>
            </div>
            <p className="mt-2 text-emerald-800">
              We sent a password-reset link and an 8-digit recovery code to <strong>{email}</strong>.
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Check your inbox (and spam/junk folder). Click the link in the email or enter the code directly.
            </p>
          </div>

          <Link
            to={`/reset-password?email=${encodeURIComponent(email)}`}
            className="flex w-full items-center justify-center rounded-lg bg-safar-teal px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-safar-dark active:scale-[0.99]"
          >
            Enter Recovery Code &rarr;
          </Link>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              Need to use a different email?
            </button>
          </div>
        </div>
      ) : (
        <form className="mx-auto mt-6 max-w-md" onSubmit={submit}>
          {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
          <label className="block">
            <span className="text-sm font-semibold">Registered email</span>
            <input
              className="focus-ring mt-2 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="e.g. yourname@cuet.ac.bd or gmail"
              required
            />
          </label>
          <Button className="mt-5 w-full" type="submit" loading={loading}>
            Send recovery link & code
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link className="font-semibold text-safar-teal" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}
