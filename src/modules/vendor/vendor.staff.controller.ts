import { Request, Response } from "express";
import { VendorStaffModel } from "../../models/VendorStaff.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { hashPassword } from "../../utils/password";

export const createVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const existing = await VendorStaffModel.findOne({ holderEmail: req.body.holderEmail });
  if (existing) throw ApiError.conflict("A staff account with this email already exists");

  const passwordHash = await hashPassword(req.body.password);
  const staff = await VendorStaffModel.create({
    vendorId: req.vendorId,
    roleName: req.body.roleName,
    holderName: req.body.holderName,
    holderEmail: req.body.holderEmail,
    holderPhone: req.body.holderPhone,
    accountType: req.body.accountType,
    permissions: req.body.permissions,
    passwordHash,
  });

  sendSuccess(res, 201, sanitize(staff), "Staff account created");
});

export const listVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await VendorStaffModel.find({ vendorId: req.vendorId }).sort({ createdAt: -1 });
  sendSuccess(res, 200, staff.map(sanitize));
});

export const updateVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await VendorStaffModel.findOne({ _id: req.params.id!, vendorId: req.vendorId });
  if (!staff) throw ApiError.notFound("Staff account not found");

  staff.set(req.body);
  await staff.save();
  sendSuccess(res, 200, sanitize(staff), "Staff account updated");
});

export const deleteVendorStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await VendorStaffModel.findOneAndDelete({ _id: req.params.id!, vendorId: req.vendorId });
  if (!staff) throw ApiError.notFound("Staff account not found");
  sendSuccess(res, 200, null, "Staff account removed");
});

function sanitize(staff: InstanceType<typeof VendorStaffModel>) {
  return {
    id: staff._id,
    roleName: staff.roleName,
    holderName: staff.holderName,
    holderEmail: staff.holderEmail,
    holderPhone: staff.holderPhone,
    accountType: staff.accountType,
    status: staff.status,
    permissions: staff.permissions,
  };
}
