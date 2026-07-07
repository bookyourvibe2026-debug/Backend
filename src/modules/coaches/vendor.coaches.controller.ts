import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  addSlot,
  checkInCoachBooking,
  createCoach,
  deleteCoach,
  getCoachForVendor,
  listCoachBookingsForVendor,
  listCoachesForVendor,
  removeSlot,
  updateCoach,
} from "../../services/coach.service";

export const getVendorCoaches = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listCoachesForVendor(req.vendorId!, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const getVendorCoachById = asyncHandler(async (req: Request, res: Response) => {
  const coach = await getCoachForVendor(req.vendorId!, req.params.id!);
  sendSuccess(res, 200, coach);
});

export const createVendorCoach = asyncHandler(async (req: Request, res: Response) => {
  const coach = await createCoach(req.vendorId!, req.body);
  sendSuccess(res, 201, coach, "Coach added");
});

export const updateVendorCoach = asyncHandler(async (req: Request, res: Response) => {
  const coach = await updateCoach(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 200, coach, "Coach updated");
});

export const deleteVendorCoach = asyncHandler(async (req: Request, res: Response) => {
  await deleteCoach(req.vendorId!, req.params.id!);
  sendSuccess(res, 200, null, "Coach removed");
});

export const addVendorCoachSlot = asyncHandler(async (req: Request, res: Response) => {
  const coach = await addSlot(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 201, coach, "Slot added");
});

export const removeVendorCoachSlot = asyncHandler(async (req: Request, res: Response) => {
  const coach = await removeSlot(req.vendorId!, req.params.id!, req.params.slotId!);
  sendSuccess(res, 200, coach, "Slot removed");
});

export const getVendorCoachBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, coachId, page, limit } = req.query as unknown as {
    status?: string;
    coachId?: string;
    page: number;
    limit: number;
  };
  const result = await listCoachBookingsForVendor(req.vendorId!, { status, coachId, page, limit });
  sendSuccess(res, 200, result);
});

export const checkInVendorCoachBooking = asyncHandler(async (req: Request, res: Response) => {
  const { booking, alreadyCheckedIn } = await checkInCoachBooking(req.params.orderId!, req.vendorId!);
  sendSuccess(res, 200, booking, alreadyCheckedIn ? "Already checked in" : "Checked in");
});
