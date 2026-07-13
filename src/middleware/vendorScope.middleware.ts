import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { VendorModel, VendorVertical } from "../models/Vendor.model";
import { asyncHandler } from "../utils/asyncHandler";

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

/**
 * Gates a feature module (tournaments, coaches, menu, listings, ...) to vendors who
 * registered for the matching role. Must run after resolveVendorScope so req.vendorId is set.
 */
export function requireVendorVertical(vertical: VendorVertical) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const vendor = await VendorModel.findById(req.vendorId).select("verticals").lean();
    if (!vendor || !vendor.verticals.includes(vertical)) {
      throw ApiError.forbidden(`This account is not registered as a ${vertical} vendor`);
    }
    next();
  });
}
