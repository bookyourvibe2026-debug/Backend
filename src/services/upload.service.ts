import { cloudinary } from "../config/cloudinary";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export interface UploadResult {
  url: string;
  publicId: string;
}

/** Uploads an in-memory image buffer to Cloudinary and returns its hosted URL. */
export function uploadImageBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
  if (!env.isCloudinaryConfigured) {
    throw ApiError.badRequest(
      "Image uploads aren't configured yet. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the backend .env."
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `byv/${folder}`, resource_type: "auto" },
      (error, result) => {
        if (error || !result) {
          reject(toUploadError(error));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// Connect/DNS failures reach us as a bare Error — or as an AggregateError whose
// own `message` is empty, one entry per address that was tried. Left alone those
// become a 500 with a blank message, which tells nobody anything. Reporting them
// as 503 also keeps them out of the "unhandled error" log stream, since the
// backend is fine; the hop to Cloudinary is not.
const NETWORK_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ENETUNREACH",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
]);

function toUploadError(error: unknown): Error {
  if (!error) return new Error("Cloudinary upload failed");

  const code = (error as { code?: unknown }).code;
  // http_code 499 is the Cloudinary SDK's own request-timeout signal.
  const httpCode = (error as { http_code?: unknown }).http_code;

  if ((typeof code === "string" && NETWORK_ERROR_CODES.has(code)) || httpCode === 499) {
    return ApiError.serviceUnavailable(
      "Couldn't reach the image service. Check your internet connection and try again."
    );
  }

  if (error instanceof Error) return error;
  const message = (error as { message?: unknown }).message;
  return new Error(typeof message === "string" && message ? message : "Cloudinary upload failed");
}
