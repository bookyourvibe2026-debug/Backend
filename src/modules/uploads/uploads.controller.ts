import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { uploadImageBuffer } from "../../services/upload.service";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB maximum limit

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
      cb(new Error("Only image and video files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const singleFile = upload.single("file");

export function uploadImageMiddleware(req: Request, res: Response, next: NextFunction): void {
  singleFile(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(ApiError.badRequest("File is too large — max 5 MB"));
      return;
    }
    next(ApiError.badRequest(err instanceof Error ? err.message : "Upload failed"));
  });
}

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file uploaded");

  const folder = typeof req.query.folder === "string" ? req.query.folder.replace(/[^a-z0-9-]/gi, "") : "misc";
  const result = await uploadImageBuffer(req.file.buffer, folder || "misc");
  sendSuccess(res, 201, result, "Uploaded");
});
