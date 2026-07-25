import { Request, Response } from "express";
import { VendorModel, VendorVertical } from "../../models/Vendor.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");
  sendSuccess(res, 200, vendor);
});

export const updateVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const { notifications, address, bankDetails, ...rest } = req.body;
  vendor.set(rest);
  if (notifications) vendor.notifications = { ...vendor.notifications, ...notifications };
  if (address) vendor.address = { ...vendor.address, ...address };
  if (bankDetails) vendor.bankDetails = { ...vendor.bankDetails, ...bankDetails };
  await vendor.save();
  sendSuccess(res, 200, vendor, "Profile updated");
});

/**
 * Lets an existing vendor switch on another business line themselves (a turf owner
 * who now also wants to run coaching, host events, or sell food) instead of needing
 * a second account.
 *
 * Deliberately add-only: removing a vertical would strand whatever listings,
 * bookings and subscriptions already live under it, and would silently 403 the
 * vendor out of their own existing data. Turning one off is a support action.
 */
export const addVendorVerticals = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const requested = req.body.verticals as VendorVertical[];
  const added = requested.filter((v) => !vendor.verticals.includes(v));
  if (added.length > 0) {
    vendor.verticals = [...vendor.verticals, ...added];
    await vendor.save();
  }

  sendSuccess(res, 200, vendor, added.length > 0 ? "Business lines added" : "No new business lines to add");
});
