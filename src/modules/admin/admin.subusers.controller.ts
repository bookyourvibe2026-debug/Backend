import { Request, Response } from "express";
import { AdminSubUserModel } from "../../models/AdminSubUser.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { hashPassword } from "../../utils/password";

export const listAdminSubUsers = asyncHandler(async (_req: Request, res: Response) => {
  const subUsers = await AdminSubUserModel.find().sort({ createdAt: -1 });
  sendSuccess(res, 200, subUsers);
});

export const createAdminSubUser = asyncHandler(async (req: Request, res: Response) => {
  const existing = await AdminSubUserModel.findOne({ email: req.body.email });
  if (existing) throw ApiError.conflict("An admin account with this email already exists");

  const passwordHash = await hashPassword(req.body.password);
  const created = await AdminSubUserModel.create({
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    permissions: req.body.permissions,
    passwordHash,
  });
  const subUser = await AdminSubUserModel.findById(created._id);

  sendSuccess(res, 201, subUser, "Sub-admin account created");
});

export const updateAdminSubUser = asyncHandler(async (req: Request, res: Response) => {
  const subUser = await AdminSubUserModel.findById(req.params.id!);
  if (!subUser) throw ApiError.notFound("Sub-admin not found");

  subUser.set(req.body);
  await subUser.save();
  sendSuccess(res, 200, subUser, "Sub-admin updated");
});

export const deleteAdminSubUser = asyncHandler(async (req: Request, res: Response) => {
  const subUser = await AdminSubUserModel.findByIdAndDelete(req.params.id!);
  if (!subUser) throw ApiError.notFound("Sub-admin not found");
  sendSuccess(res, 200, null, "Sub-admin removed");
});
