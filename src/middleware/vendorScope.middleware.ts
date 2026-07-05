import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Resolves the vendor business a request acts on: the vendor's own id when logged in as
 * the owner, or the parent vendorId embedded in the staff/subadmin token. Downstream
 * handlers must scope every query by `req.vendorId`, never by a client-supplied id.
 */
export function resolveVendorScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(ApiError.unauthorized());
    return;
  }

  req.vendorId = req.auth.role === "vendor" ? req.auth.sub : req.auth.vendorId;
  if (!req.vendorId) {
    next(ApiError.forbidden("No vendor context found for this account"));
    return;
  }
  next();
}
