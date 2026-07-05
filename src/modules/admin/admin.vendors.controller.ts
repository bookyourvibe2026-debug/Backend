import { Request, Response } from "express";
import { VendorModel } from "../../models/Vendor.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { hashPassword } from "../../utils/password";

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const filter = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    VendorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    VendorModel.countDocuments(filter),
  ]);

  sendSuccess(res, 200, { items, total, page, limit, pages: Math.ceil(total / limit) });
});

export const getVendorById = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.params.id!);
  if (!vendor) throw ApiError.notFound("Vendor not found");
  sendSuccess(res, 200, vendor);
});

export const updateVendorStatus = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.params.id!);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  vendor.status = req.body.status;
  if (req.body.status === "approved") vendor.approvedOn = new Date();
  await vendor.save();

  sendSuccess(res, 200, vendor, "Vendor status updated");
});

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const { ownerName, businessName, email, phone, state, city, password, status } = req.body;

  const existing = await VendorModel.findOne({ $or: [{ email }, { phone }] });
  if (existing) throw ApiError.conflict("A vendor account with this email or phone already exists");

  const passwordHash = await hashPassword(password);
  const created = await VendorModel.create({
    ownerName,
    businessName,
    email,
    phone,
    state,
    city,
    passwordHash,
    status: status ?? "approved",
    approvedOn: (status ?? "approved") === "approved" ? new Date() : null,
  });
  const vendor = await VendorModel.findById(created._id);

  sendSuccess(res, 201, vendor, "Vendor created");
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findById(req.params.id!);
  if (!vendor) throw ApiError.notFound("Vendor not found");

  const { notifications, ...rest } = req.body;
  vendor.set(rest);
  if (notifications) vendor.notifications = { ...vendor.notifications, ...notifications };
  await vendor.save();

  sendSuccess(res, 200, vendor, "Vendor updated");
});

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await VendorModel.findByIdAndDelete(req.params.id!);
  if (!vendor) throw ApiError.notFound("Vendor not found");
  sendSuccess(res, 200, null, "Vendor deleted");
});
