import { randomBytes } from "node:crypto";

const DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEVELOPMENT_OTP_SECRET = randomBytes(32).toString("hex");

function parseOrigins(value) {
  if (!value) return DEFAULT_ORIGINS;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function integer(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: integer(process.env.PORT, 5000),
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGINS || process.env.FRONTEND_URL),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: integer(process.env.SMTP_PORT, 587),
  smtpSecure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  smtpFrom: process.env.SMTP_FROM || "",
  otpHashSecret: process.env.OTP_HASH_SECRET || (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_OTP_SECRET),
  otpExpiresMinutes: integer(process.env.OTP_EXPIRES_MINUTES, 10),
  otpResendCooldownSeconds: integer(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
  otpMaxAttempts: integer(process.env.OTP_MAX_ATTEMPTS, 5),
  otpMaxRequestsPerHour: integer(process.env.OTP_MAX_REQUESTS_PER_HOUR, 5),
  cloudinaryCloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim().replace(/^["']|["']$/g, ""),
  cloudinaryApiKey: String(process.env.CLOUDINARY_API_KEY || "").trim().replace(/^["']|["']$/g, ""),
  cloudinaryApiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim().replace(/^["']|["']$/g, ""),
};

export function validateEnvironment({ requireSmtp = env.nodeEnv === "production" } = {}) {
  const required = [
    ["SUPABASE_URL", env.supabaseUrl],
    ["SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)", env.supabasePublishableKey],
    ["SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)", env.supabaseSecretKey],
    ["OTP_HASH_SECRET", env.otpHashSecret],
  ];
  if (requireSmtp) {
    required.push(
      ["SMTP_HOST", env.smtpHost],
      ["SMTP_USER", env.smtpUser],
      ["SMTP_PASSWORD", env.smtpPassword],
      ["SMTP_FROM", env.smtpFrom],
    );
  }

  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

  const integerSettings = [
    ["PORT", env.port, 1, 65535],
    ["SMTP_PORT", env.smtpPort, 1, 65535],
    ["OTP_EXPIRES_MINUTES", env.otpExpiresMinutes, 1, 60],
    ["OTP_RESEND_COOLDOWN_SECONDS", env.otpResendCooldownSeconds, 1, 3600],
    ["OTP_MAX_ATTEMPTS", env.otpMaxAttempts, 1, 20],
    ["OTP_MAX_REQUESTS_PER_HOUR", env.otpMaxRequestsPerHour, 1, 100],
  ];
  for (const [name, value, minimum, maximum] of integerSettings) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    }
  }
  if (env.otpHashSecret.length < 32) throw new Error("OTP_HASH_SECRET must contain at least 32 characters.");

  return env;
}
