import { apiRequest } from "./api";

/**
 * Fetch featured bus photos for the carousel.
 * Accessible to all authenticated users.
 */
export async function getFeaturedBusPhotos() {
  return apiRequest("/transport/featured-photos");
}

/**
 * Fetch featured bus photos with admin details.
 */
export async function getAdminFeaturedBusPhotos() {
  return apiRequest("/admin/transport/featured-photos");
}

/**
 * Upload a new bus photo to Cloudinary and add to carousel.
 * (Admin only)
 *
 * @param {object} params
 * @param {File} params.file
 * @param {string} [params.title]
 * @param {string} [params.caption]
 * @param {string} [params.busId]
 */
export async function uploadFeaturedBusPhoto({ file, title, caption, busId }) {
  const formData = new FormData();
  formData.append("photo", file);
  if (title) formData.append("title", title);
  if (caption) formData.append("caption", caption);
  if (busId) formData.append("busId", busId);

  return apiRequest("/admin/transport/featured-photos", {
    method: "POST",
    body: formData,
  });
}

/**
 * Delete a featured bus photo.
 * (Admin only)
 */
export async function deleteFeaturedBusPhoto(id) {
  return apiRequest(`/admin/transport/featured-photos/${id}`, {
    method: "DELETE",
  });
}

