import { type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import { ALLOWED_IMAGE_TYPES } from '../util/objectStorage';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_MB = MAX_IMAGE_BYTES / (1024 * 1024);
// Marker so the wrapper can distinguish a rejected mimetype from other errors.
const UNSUPPORTED_IMAGE_TYPE = 'UNSUPPORTED_IMAGE_TYPE';

// Uploaded images are held in memory and streamed straight to R2; they never
// touch disk. Allowed mimetypes come from objectStorage's single source.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(new Error(UNSUPPORTED_IMAGE_TYPE));
      return;
    }
    cb(null, true);
  },
});

/**
 * Middleware that reads a single `image` field into `req.file` and turns
 * multer's errors into specific JSON 400s so the client can show a meaningful
 * message (e.g. file too large, wrong type). Shared by every image-upload route.
 */
export const uploadImageFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  imageUpload.single('image')(req, res, (error: unknown) => {
    if (error instanceof MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? `Image is too large. Maximum size is ${MAX_IMAGE_MB} MB.`
          : 'Could not process the uploaded image.';
      res.status(400).json({ message });
      return;
    }
    if (error instanceof Error && error.message === UNSUPPORTED_IMAGE_TYPE) {
      res
        .status(400)
        .json({ message: 'Unsupported image type. Use PNG, JPEG, or WebP.' });
      return;
    }
    if (error != null) {
      next(error);
      return;
    }
    next();
  });
};
