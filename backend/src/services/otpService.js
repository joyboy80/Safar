import { randomInt } from "node:crypto";
import { env } from "../config/env.js";
import AppError from "../utils/AppError.js";
import { getSupabaseAdmin } from "../config/supabase.js";
import { getProfileByEmail, serializeProfile, updateProfile } from "./profileService.js";
import { sendRegistrationOtp } from "./emailService.js";
import { hashOtp, verifyOtpHash } from "./otpCrypto.js";

const PURPOSE = "REGISTRATION";

async function latestVerification(email, { activeOnly = false } = {}) {
  let query = getSupabaseAdmin()
    .from("email_verifications")
    .select("*")
    .ilike("email", email)
    .eq("purpose", PURPOSE)
    .order("created_at", { ascending: false })
    .limit(1);
  if (activeOnly) query = query.is("verified_at", null).is("invalidated_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError(500, "Unable to check the verification code.", "OTP_READ_FAILED");
  return data;
}

export async function issueRegistrationOtp(email) {
  const profile = await getProfileByEmail(email);
  if (!profile) throw new AppError(404, "No pending registration was found for this email.", "REGISTRATION_NOT_FOUND");
  if (profile.is_verified) throw new AppError(409, "This email is already verified.", "EMAIL_ALREADY_VERIFIED");

  const latest = await latestVerification(email);

  // Rate limits removed for testing

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error: invalidateError } = await admin
    .from("email_verifications")
    .update({ invalidated_at: now })
    .ilike("email", email)
    .eq("purpose", PURPOSE)
    .is("verified_at", null)
    .is("invalidated_at", null);
  if (invalidateError) throw new AppError(500, "Unable to issue a verification code.", "OTP_CREATE_FAILED");

  const otp = String(randomInt(100000, 1000000));
  const { data: verification, error: insertError } = await admin.from("email_verifications").insert({
    email,
    otp_hash: hashOtp(email, otp),
    purpose: PURPOSE,
    expires_at: new Date(Date.now() + env.otpExpiresMinutes * 60 * 1000).toISOString(),
  }).select("id, expires_at").single();
  if (insertError) throw new AppError(500, "Unable to issue a verification code.", "OTP_CREATE_FAILED");

  let delivery;
  try {
    delivery = await sendRegistrationOtp(email, otp);
  } catch (error) {
    await admin.from("email_verifications").update({ invalidated_at: new Date().toISOString() }).eq("id", verification.id);
    throw error;
  }

  return {
    email,
    expiresAt: verification.expires_at,
    resendAfterSeconds: env.otpResendCooldownSeconds,
    delivery: delivery.delivery,
    ...(delivery?.devOtp ? { devOtp: delivery.devOtp } : {}),
  };
}

export async function verifyRegistrationOtp(email, otp) {
  const verification = await latestVerification(email, { activeOnly: true });
  if (!verification) throw new AppError(400, "The verification code is invalid or has already been used.", "INVALID_OTP");

  const admin = getSupabaseAdmin();
  if (new Date(verification.expires_at).getTime() <= Date.now()) {
    await admin.from("email_verifications").update({ invalidated_at: new Date().toISOString() }).eq("id", verification.id);
    throw new AppError(410, "The verification code has expired. Request a new code.", "OTP_EXPIRED");
  }
  if (verification.attempt_count >= env.otpMaxAttempts) {
    await admin.from("email_verifications").update({ invalidated_at: new Date().toISOString() }).eq("id", verification.id);
    throw new AppError(429, "Too many incorrect attempts. Request a new code.", "OTP_ATTEMPTS_EXCEEDED");
  }

  if (!verifyOtpHash(email, otp, verification.otp_hash)) {
    const attemptCount = verification.attempt_count + 1;
    await admin.from("email_verifications").update({
      attempt_count: attemptCount,
      ...(attemptCount >= env.otpMaxAttempts ? { invalidated_at: new Date().toISOString() } : {}),
    }).eq("id", verification.id);
    if (attemptCount >= env.otpMaxAttempts) {
      throw new AppError(429, "Too many incorrect attempts. Request a new code.", "OTP_ATTEMPTS_EXCEEDED");
    }
    throw new AppError(400, "The verification code is invalid.", "INVALID_OTP", { attemptsRemaining: env.otpMaxAttempts - attemptCount });
  }

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("email_verifications")
    .update({ verified_at: claimedAt })
    .eq("id", verification.id)
    .is("verified_at", null)
    .is("invalidated_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw new AppError(500, "Unable to finalize the verification code.", "OTP_FINALIZE_FAILED");
  if (!claimed) throw new AppError(400, "The verification code has already been used.", "INVALID_OTP");

  const profile = await getProfileByEmail(email);
  if (!profile || profile.is_verified) throw new AppError(409, "This registration is no longer pending verification.", "REGISTRATION_NOT_PENDING");

  let updated;
  try {
    updated = await updateProfile(profile.auth_user_id, {
      is_verified: true,
      approval_status: "APPROVED",
      registration_status: "VERIFIED",
    });
  } catch (error) {
    await admin.from("email_verifications").update({ verified_at: null }).eq("id", verification.id).eq("verified_at", claimedAt);
    throw error;
  }

  const { error: authError } = await admin.auth.admin.updateUserById(profile.auth_user_id, { email_confirm: true });
  if (authError) {
    await Promise.allSettled([
      updateProfile(profile.auth_user_id, {
        is_verified: profile.is_verified,
        approval_status: profile.approval_status,
        registration_status: profile.registration_status,
      }),
      admin.from("email_verifications").update({ verified_at: null }).eq("id", verification.id).eq("verified_at", claimedAt),
    ]);
    throw new AppError(500, "Unable to activate the authentication account. The verification can be retried.", "AUTH_ACTIVATION_FAILED");
  }

  return { user: serializeProfile(updated), requiresApproval: false };
}
