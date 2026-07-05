import { NextFunction, Request, Response } from "express";
import { AdminSubUserModel, type AdminModuleKey } from "../models/AdminSubUser.model";
import { VendorStaffModel, type ModulePermissionKey } from "../models/VendorStaff.model";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

type Action = "view" | "create" | "edit" | "delete";

/** Vendor owners have full access; staff/subadmin permissions are re-checked from the DB on every request. */
export function requireVendorPermission(moduleKey: ModulePermissionKey, action: Action) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "vendor") {
      next();
      return;
    }

    const staff = await VendorStaffModel.findById(req.auth.sub);
    if (!staff || staff.status === "Inactive") {
      throw ApiError.forbidden("Access revoked");
    }
    if (!staff.permissions[moduleKey]?.[action]) {
      throw ApiError.forbidden(`You do not have ${action} access to ${moduleKey}`);
    }
    next();
  });
}

/** Super admins have full access; sub-admin permissions are re-checked from the DB on every request. */
export function requireAdminPermission(moduleKey: AdminModuleKey, action: Action) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "super_admin") {
      next();
      return;
    }

    const subUser = await AdminSubUserModel.findById(req.auth.sub);
    if (!subUser || subUser.status === "Inactive") {
      throw ApiError.forbidden("Access revoked");
    }
    if (!subUser.permissions[moduleKey]?.[action]) {
      throw ApiError.forbidden(`You do not have ${action} access to ${moduleKey}`);
    }
    next();
  });
}
