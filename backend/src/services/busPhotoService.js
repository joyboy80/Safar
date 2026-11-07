import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "../config/supabase.js";
import { uploadImageBuffer, deleteCloudinaryImage } from "./cloudinaryService.js";
import AppError from "../utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_DATA_DIR = path.resolve(__dirname, "../../data");
const FALLBACK_FILE_PATH = path.join(FALLBACK_DATA_DIR, "featured_bus_photos.json");

async function ensureFallbackFile() {
  await fs.mkdir(FALLBACK_DATA_DIR, { recursive: true });
  try {
    await fs.access(FALLBACK_FILE_PATH);
  } catch {
    await fs.writeFile(FALLBACK_FILE_PATH, JSON.stringify([], null, 2), "utf8");
  }
}

async function readFallbackPhotos() {
  await ensureFallbackFile();
  try {
    const raw = await fs.readFile(FALLBACK_FILE_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

async function writeFallbackPhotos(photos) {
  await ensureFallbackFile();
  await fs.writeFile(FALLBACK_FILE_PATH, JSON.stringify(photos, null, 2), "utf8");
}

export async function listFeaturedBusPhotos() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("featured_bus_photos")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch {
    // Supabase table query failed, proceed to fallback
  }

  // Fallback to local storage if table doesn't exist yet
  const local = await readFallbackPhotos();
  return local
    .filter((p) => p.is_active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || new Date(b.created_at) - new Date(a.created_at));
}

export async function createFeaturedBusPhoto({ title, caption, busId, fileBuffer, uploadedBy }) {
  if (!fileBuffer) {
    throw new AppError(400, "Image file buffer is required.", "MISSING_FILE");
  }

  // 1. Upload to Cloudinary
  const uploadResult = await uploadImageBuffer(fileBuffer, {
    folder: "safar/bus-photos",
    transformation: [
      { quality: "auto", fetch_format: "auto" },
    ],
  });

  const record = {
    id: randomUUID(),
    title: (title || "").trim() || "Featured CUET Bus",
    caption: (caption || "").trim() || "",
    bus_id: busId || null,
    image_url: uploadResult.secure_url,
    public_id: uploadResult.public_id,
    uploaded_by: uploadedBy || null,
    display_order: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 2. Persist to Supabase
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("featured_bus_photos")
      .insert(record)
      .select("*")
      .single();

    if (!error && data) {
      return data;
    }
  } catch {
    // Proceed to fallback if Supabase table is absent
  }

  // Fallback persistence
  const local = await readFallbackPhotos();
  local.unshift(record);
  await writeFallbackPhotos(local);
  return record;
}

export async function deleteFeaturedBusPhoto(id) {
  if (!id) throw new AppError(400, "Photo ID is required.", "VALIDATION_ERROR");

  let photo = null;

  // 1. Try finding and deleting from Supabase
  try {
    const { data: found } = await getSupabaseAdmin()
      .from("featured_bus_photos")
      .select("public_id")
      .eq("id", id)
      .maybeSingle();

    if (found) {
      photo = found;
      await getSupabaseAdmin().from("featured_bus_photos").delete().eq("id", id);
    }
  } catch {
    // Fallback handling
  }

  // 2. Also ensure deleted in fallback
  const local = await readFallbackPhotos();
  const index = local.findIndex((p) => p.id === id);
  if (index !== -1) {
    photo ||= local[index];
    local.splice(index, 1);
    await writeFallbackPhotos(local);
  }

  // 3. Remove asset from Cloudinary
  if (photo?.public_id) {
    await deleteCloudinaryImage(photo.public_id);
  }

  return { success: true, id };
}

