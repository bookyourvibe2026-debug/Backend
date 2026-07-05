import { Request, Response } from "express";
import { VendorModel } from "../../models/Vendor.model";
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
