import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field "${err.path}"`;
  } else if (isMongoDuplicateKeyError(err)) {
    statusCode = 409;
    message = "A record with these details already exists";
    details = err.keyValue;
  } else if (err instanceof Error) {
    message = env.isProduction ? message : err.message;
  }

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, "Unhandled error");
  } else {
    logger.warn({ path: req.originalUrl, method: req.method, message }, "Request error");
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details !== undefined ? { details } : {}),
    ...(env.isDevelopment && err instanceof Error ? { stack: err.stack } : {}),
  });
}

// Reached through mongoose's re-export rather than importing "mongodb" directly:
// the driver is only a transitive dep, and declaring it separately risks a second
// copy at a different version than the one mongoose actually throws from.
function isMongoDuplicateKeyError(
  err: unknown
): err is mongoose.mongo.MongoServerError & { keyValue: Record<string, unknown> } {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
