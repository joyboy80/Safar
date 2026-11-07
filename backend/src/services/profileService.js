import { getSupabaseAdmin } from "../config/supabase.js";
import AppError from "../utils/AppError.js";

export function serializeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    name: profile.full_name,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    userType: profile.user_type,
    // Legacy UI compatibility only; authorization always uses userType.
    role: profile.user_type === "TRANSPORT_ADMIN" ? "ADMIN" : profile.user_type,
    batch: profile.batch,
    departmentCode: profile.department_code,
    department: profile.department_name,
    institutionalId: profile.institutional_id,
    employeeId: profile.user_type === "STUDENT" ? null : profile.institutional_id,
    studentId: profile.student_id,
    gender: profile.gender,
    profileImage: profile.profile_image,
    isVerified: profile.is_verified,
    isActive: profile.is_active,
    approvalStatus: profile.approval_status,
    registrationStatus: profile.registration_status,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function profileError(error, operation, duplicateMessage) {
  const duplicate = error?.code === "23505";
  return new AppError(
    duplicate ? 409 : 500,
    duplicate ? duplicateMessage : `Unable to ${operation} the user profile.`,
    duplicate ? "PROFILE_CONFLICT" : `PROFILE_${operation.toUpperCase()}_FAILED`,
  );
}

export async function getProfileByAuthUserId(authUserId) {
  const { data, error } = await getSupabaseAdmin().from("profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw profileError(error, "read", "A profile already exists.");
  return data;
}

export async function getProfileByEmail(email) {
  const { data, error } = await getSupabaseAdmin().from("profiles").select("*").ilike("email", email).maybeSingle();
  if (error) throw profileError(error, "read", "A profile already exists.");
  return data;
}

export async function getProfileById(profileId) {
  const { data, error } = await getSupabaseAdmin().from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (error) throw profileError(error, "read", "A profile already exists.");
  return data;
}

export async function createProfile(profile) {
  let insertPayload = { ...profile };
  let { data, error } = await getSupabaseAdmin().from("profiles").insert(insertPayload).select("*").single();

  if (error && (error.code === "PGRST204" || error.message?.includes("batch")) && Object.hasOwn(insertPayload, "batch")) {
    const { batch, ...withoutBatch } = insertPayload;
    const fallback = await getSupabaseAdmin().from("profiles").insert(withoutBatch).select("*").single();
    if (!fallback.error) return { ...fallback.data, batch };
    error = fallback.error;
  }

  if (error) throw profileError(error, "create", "An account with that email or university identifier already exists.");
  return data;
}

export async function updateProfile(authUserId, updates) {
  const { preferences, profileImage, ...dbUpdates } = updates;
  if (profileImage !== undefined) {
    dbUpdates.profile_image = profileImage;
  }
  
  if (preferences) {
    const { error: metaError } = await getSupabaseAdmin().auth.admin.updateUserById(authUserId, {
      user_metadata: { preferences }
    });
    if (metaError) throw profileError(metaError, "update", "Unable to update preferences.");
  }

  if (Object.keys(dbUpdates).length > 0) {
    const { data, error } = await getSupabaseAdmin().from("profiles").update(dbUpdates).eq("auth_user_id", authUserId).select("*").single();
    if (error) throw profileError(error, "update", "That profile value is already in use.");
    return data;
  }
  
  return getProfileByAuthUserId(authUserId);
}

export async function updateProfileById(profileId, updates) {
  const { data, error } = await getSupabaseAdmin().from("profiles").update(updates).eq("id", profileId).select("*").single();
  if (error) throw profileError(error, "update", "That profile value is already in use.");
  return data;
}

export async function listPendingDrivers() {
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("*")
    .eq("user_type", "DRIVER")
    .eq("is_verified", true)
    .eq("approval_status", "PENDING")
    .order("created_at", { ascending: true });
  if (error) throw profileError(error, "read", "A profile already exists.");
  return data.map(serializeProfile);
}
