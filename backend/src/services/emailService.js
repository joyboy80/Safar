import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import AppError from "../utils/AppError.js";

let transporter;

export function isEmailDeliveryConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPassword && env.smtpFrom);
}

function getTransporter() {
  transporter ||= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPassword },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 4000,
  });
  return transporter;
}

export async function verifyEmailTransport({ requireConfigured = false } = {}) {
  if (!isEmailDeliveryConfigured()) {
    if (requireConfigured) {
      throw new AppError(500, "SMTP is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM to backend/.env.", "SMTP_NOT_CONFIGURED");
    }
    return { configured: false, verified: false };
  }

  try {
    await getTransporter().verify();
    return { configured: true, verified: true };
  } catch (error) {
    console.error("[SAFAR email] SMTP verification failed", {
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
    });
    throw new AppError(502, "Unable to authenticate with the configured email server.", "SMTP_CONNECTION_FAILED");
  }
}

export async function sendRegistrationOtp(email, otp, { clientOrigin } = {}) {
  const text = [
    "SAFAR",
    "University Transportation System",
    "",
    "Your verification code is:",
    otp,
    "",
    `This code expires in ${env.otpExpiresMinutes} minutes.`,
    "",
    "If you did not request this verification code, please ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
  <html><body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#18332c">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
        <tr><td style="padding:24px 32px;background:#075e54;color:#fff"><strong style="font-size:26px">SAFAR</strong><br><span>University Transportation System</span></td></tr>
        <tr><td style="padding:32px;text-align:center"><p>Your verification code is:</p><div style="font-size:36px;font-weight:700;letter-spacing:10px;margin:22px 0">${otp}</div><p>This code expires in ${env.otpExpiresMinutes} minutes.</p><p style="color:#687773;font-size:14px">If you did not request this verification code, please ignore this email.</p></td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  // 1. If Resend API key is provided, use HTTPS Port 443
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.smtpFrom || "SAFAR <onboarding@resend.dev>",
          to: [email],
          subject: "Your SAFAR verification code",
          text,
          html,
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        return { delivered: true, delivery: "EMAIL", messageId: payload.id };
      }
      console.warn("[SAFAR email] Resend attempt non-OK status:", response.status);
    } catch (resendError) {
      console.warn("[SAFAR email] Resend API failed:", resendError?.message);
    }
  }

  // 2. If direct SMTP is available (e.g. running locally or on unblocked hosts), try it with a 3s timeout
  if (isEmailDeliveryConfigured() && env.nodeEnv !== "production") {
    try {
      const info = await getTransporter().sendMail({
        from: env.smtpFrom,
        to: email,
        subject: "Your SAFAR verification code",
        text,
        html,
      });
      return { delivered: true, delivery: "EMAIL", messageId: info?.messageId };
    } catch (error) {
      console.warn("[SAFAR email] Direct SMTP failed or timed out:", error?.message);
    }
  }

  // 3. Vercel Gmail Relay (unblocks Port 587 on Render Free tier via Vercel Serverless)
  if (isEmailDeliveryConfigured()) {
    const relayCandidates = [];
    if (clientOrigin && /^https?:\/\//i.test(clientOrigin) && !clientOrigin.includes("localhost")) {
      relayCandidates.push(`${clientOrigin.replace(/\/$/, "")}/api/send-email`);
    }
    if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")) {
      relayCandidates.push(`${process.env.FRONTEND_URL.replace(/\/$/, "")}/api/send-email`);
    }
    for (const origin of env.clientOrigins || []) {
      if (origin && !origin.includes("localhost") && /^https?:\/\//i.test(origin)) {
        const url = `${origin.replace(/\/$/, "")}/api/send-email`;
        if (!relayCandidates.includes(url)) relayCandidates.push(url);
      }
    }

    for (const relayUrl of relayCandidates) {
      try {
        const relayRes = await fetch(relayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: "Your SAFAR verification code",
            text,
            html,
            from: env.smtpFrom,
            auth: {
              user: env.smtpUser,
              pass: env.smtpPassword,
            },
          }),
          signal: AbortSignal.timeout(9000),
        });
        if (relayRes.ok) {
          const payload = await relayRes.json().catch(() => ({}));
          console.info(`[SAFAR email] Successfully sent verification email via relay (${relayUrl})`);
          return { delivered: true, delivery: "EMAIL", messageId: payload.messageId };
        }
        console.warn(`[SAFAR email] Relay ${relayUrl} returned status ${relayRes.status}`);
      } catch (relayError) {
        console.warn(`[SAFAR email] Relay to ${relayUrl} failed:`, relayError?.message);
      }
    }

    // 4. If on production and relay was skipped/failed, attempt direct SMTP as last resort
    if (env.nodeEnv === "production") {
      try {
        const info = await getTransporter().sendMail({
          from: env.smtpFrom,
          to: email,
          subject: "Your SAFAR verification code",
          text,
          html,
        });
        return { delivered: true, delivery: "EMAIL", messageId: info?.messageId };
      } catch (error) {
        console.warn("[SAFAR email] Production direct SMTP failed:", error?.message);
      }
    }
  }

  // 5. Fallback: Log to backend terminal only
  console.info(`[SAFAR OTP Console Fallback] Code for ${email}: ${otp} (expires in ${env.otpExpiresMinutes} minutes)`);
  return { delivered: false, delivery: "DEVELOPMENT_CONSOLE" };
}
