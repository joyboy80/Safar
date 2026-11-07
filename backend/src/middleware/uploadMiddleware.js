import multer from "multer";
import AppError from "../utils/AppError.js";

const storage = multer.memoryStorage();

function imageFilter(_req, file, cb) {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/jpg",
  ];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        400,
        "Invalid file format. Only JPEG, PNG, WEBP, and GIF images are supported.",
        "INVALID_FILE_TYPE"
      ),
      false
    );
  }
}

const avatarMulter = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: imageFilter,
}).single("avatar");

const busPhotoMulter = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: imageFilter,
}).single("photo");

/**
 * Higher-order middleware to wrap multer execution and catch multer-specific errors.
 */
export function handleUpload(multerUploadInstance) {
  return (req, res, next) => {
    multerUploadInstance(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(
              new AppError(
                400,
                "The selected image exceeds the maximum permitted file size.",
                "FILE_TOO_LARGE"
              )
            );
          }
          return next(new AppError(400, err.message, "UPLOAD_ERROR"));
        }
        return next(err);
      }
      next();
    });
  };
}

export const uploadAvatarMiddleware = handleUpload(avatarMulter);
export const uploadBusPhotoMiddleware = handleUpload(busPhotoMulter);

