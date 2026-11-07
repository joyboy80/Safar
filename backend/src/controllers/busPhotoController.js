import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";
import {
  createFeaturedBusPhoto,
  deleteFeaturedBusPhoto,
  listFeaturedBusPhotos,
} from "../services/busPhotoService.js";

export const getFeaturedPhotos = asyncHandler(async (_req, res) => {
  const photos = await listFeaturedBusPhotos();
  return sendSuccess(res, { data: photos });
});

export const getAdminFeaturedPhotos = asyncHandler(async (_req, res) => {
  const photos = await listFeaturedBusPhotos();
  return sendSuccess(res, { data: photos });
});

export const postAdminFeaturedPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "Please select an image file to upload as a featured bus photo.", "NO_FILE_UPLOADED");
  }

  const { title, caption, busId } = req.body || {};
  const photo = await createFeaturedBusPhoto({
    title,
    caption,
    busId,
    fileBuffer: req.file.buffer,
    uploadedBy: req.user.authUserId,
  });

  return sendSuccess(res, {
    status: 201,
    data: photo,
    message: "Bus photo successfully uploaded and added to the carousel.",
  });
});

export const deleteAdminFeaturedPhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await deleteFeaturedBusPhoto(id);
  return sendSuccess(res, {
    data: result,
    message: "Featured bus photo removed successfully.",
  });
});

