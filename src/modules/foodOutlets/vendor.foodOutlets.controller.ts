import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  addOutletLeave,
  createOutlet,
  deleteOutlet,
  getOutletForVendor,
  listOutletsForVendor,
  removeOutletLeave,
  setOutletWeeklyAvailability,
  updateOutlet,
} from "../../services/foodOutlet.service";

export const getVendorOutlets = asyncHandler(async (req: Request, res: Response) => {
  const outlets = await listOutletsForVendor(req.vendorId!);
  sendSuccess(res, 200, outlets);
});

export const getVendorOutletById = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await getOutletForVendor(req.vendorId!, req.params.id!);
  sendSuccess(res, 200, outlet);
});

export const createVendorOutlet = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await createOutlet(req.vendorId!, req.body);
  sendSuccess(res, 201, outlet, "Restaurant added");
});

export const updateVendorOutlet = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await updateOutlet(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 200, outlet, "Restaurant updated");
});

export const deleteVendorOutlet = asyncHandler(async (req: Request, res: Response) => {
  await deleteOutlet(req.vendorId!, req.params.id!);
  sendSuccess(res, 200, null, "Restaurant removed");
});

export const setVendorOutletAvailability = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await setOutletWeeklyAvailability(req.vendorId!, req.params.id!, req.body.days);
  sendSuccess(res, 200, outlet, "Opening hours updated");
});

export const addVendorOutletLeave = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await addOutletLeave(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 201, outlet, "Holiday added");
});

export const removeVendorOutletLeave = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await removeOutletLeave(req.vendorId!, req.params.id!, req.params.date!);
  sendSuccess(res, 200, outlet, "Holiday removed");
});
