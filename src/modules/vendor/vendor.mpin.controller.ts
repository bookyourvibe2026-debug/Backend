import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { VendorModel } from "../../models/Vendor.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { requestOtp, verifyOtp } from "../../services/otp.service";

const BCRYPT_ROUNDS = 12;

/** POST /vendor/mpin/status — returns whether vendor has an MPIN set */
export const getMpinStatus = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.vendorId).select("+mpinHash");
  if (!vendor) throw ApiError.notFound("Vendor not found");
  sendSuccess(res, 200, { hasPin: Boolean(vendor.mpinHash) });
});

/** POST /vendor/mpin/set — create MPIN (first-time only) */
export const setMpin = asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body as { pin?: string };
  if (!pin || !/^\d{4}$/.test(pin)) throw ApiError.badRequest("PIN must be exactly 4 digits");
  const vendor = await VendorModel.findById(req.vendorId).select("+mpinHash");
  if (!vendor) throw ApiError.notFound("Vendor not found");
  if (vendor.mpinHash) throw ApiError.badRequest("MPIN already set. Use change-mpin flow to update it.");
  const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  await VendorModel.updateOne({ _id: vendor._id }, { $set: { mpinHash: hash } });
  sendSuccess(res, 200, null, "MPIN set successfully");
});

/** POST /vendor/mpin/verify — verify entered MPIN */
export const verifyMpin = asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body as { pin?: string };
  if (!pin || !/^\d{4}$/.test(pin)) throw ApiError.badRequest("PIN must be exactly 4 digits");
  const vendor = await VendorModel.findById(req.vendorId).select("+mpinHash");
  if (!vendor) throw ApiError.notFound("Vendor not found");
  if (!vendor.mpinHash) throw ApiError.badRequest("MPIN not set. Please create your MPIN first.");
  const match = await bcrypt.compare(pin, vendor.mpinHash);
  if (!match) throw ApiError.unauthorized("Incorrect MPIN");
  sendSuccess(res, 200, null, "MPIN verified");
});

/** POST /vendor/mpin/change/request — send OTP to vendor email */
export const requestMpinChange = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found");
  await requestOtp(vendor.email, "vendor_mpin_change");
  sendSuccess(res, 200, null, `OTP sent to ${vendor.email}`);
});

/** POST /vendor/mpin/change/confirm — verify OTP and update MPIN */
export const confirmMpinChange = asyncHandler(async (req: Request, res: Response) => {
  const { otp, newPin } = req.body as { otp?: string; newPin?: string };
  if (!otp) throw ApiError.badRequest("OTP is required");
  if (!newPin || !/^\d{4}$/.test(newPin)) throw ApiError.badRequest("New PIN must be exactly 4 digits");
  const vendor = await VendorModel.findById(req.vendorId).select("+mpinHash");
  if (!vendor) throw ApiError.notFound("Vendor not found");
  await verifyOtp(vendor.email, "vendor_mpin_change", otp);
  const hash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
  await VendorModel.updateOne({ _id: vendor._id }, { $set: { mpinHash: hash } });
  sendSuccess(res, 200, null, "MPIN changed successfully");
});
