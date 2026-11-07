import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import AppError from "../utils/AppError.js";

function ensureCloudinaryConfigured() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || env.cloudinaryCloudName || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const apiKey = String(process.env.CLOUDINARY_API_KEY || env.cloudinaryApiKey || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || env.cloudinaryApiSecret || "")
    .trim()
    .replace(/^["']|["']$/g, "");

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      500,
      "Cloudinary credentials are not configured in backend/.env. Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are provided.",
      "CLOUDINARY_CONFIG_MISSING"
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

/**
 * Upload an image buffer directly to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer - Raw file buffer from multer.
 * @param {object} options
 * @param {string} options.folder - Destination folder in Cloudinary (e.g. "safar/avatars", "safar/bus-photos").
 * @param {string} [options.publicId] - Optional explicit public ID.
 * @param {Array|object} [options.transformation] - Optional Cloudinary image transformations.
 * @returns {Promise<object>} Upload result with secure_url, public_id, width, height, format, etc.
 */
export async function uploadImageBuffer(buffer, { folder = "safar", publicId, transformation } = {}) {
  const cld = ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cld.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: "image",
        transformation,
      },
      (error, result) => {
        if (error) {
          let message = error.message || "Failed to upload image to Cloudinary.";
          if (error.http_code === 401 && error.message?.includes("cloud_name mismatch")) {
            message =
              "Cloudinary authentication failed: 'cloud_name mismatch'. " +
              "Please verify that CLOUDINARY_CLOUD_NAME in your backend/.env matches the exact Cloud Name shown in your Cloudinary Dashboard.";
          }
          return reject(new AppError(error.http_code || 500, message, "CLOUDINARY_UPLOAD_FAILED"));
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by its public ID.
 *
 * @param {string} publicId
 * @returns {Promise<object|null>}
 */
export async function deleteCloudinaryImage(publicId) {
  if (!publicId) return null;
  try {
    const cld = ensureCloudinaryConfigured();
    return await cld.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary destroy failed:", err.message);
    return null;
  }
}

