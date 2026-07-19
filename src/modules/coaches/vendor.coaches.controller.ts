import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  addBatch,
  addLeave,
  createCoach,
  deleteCoach,
  getCoachForVendor,
  listCoachesForVendor,
  listSubscriptionsForVendor,
  removeBatch,
  removeLeave,
  setWeeklyAvailability,
  updateBatch,
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

/* ---- Weekly availability ---- */
export const setVendorCoachAvailability = asyncHandler(async (req: Request, res: Response) => {
  const coach = await setWeeklyAvailability(req.vendorId!, req.params.id!, req.body.days);
  sendSuccess(res, 200, coach, "Availability updated");
});

/* ---- Batches ---- */
export const addVendorCoachBatch = asyncHandler(async (req: Request, res: Response) => {
  const coach = await addBatch(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 201, coach, "Batch added");
});

export const updateVendorCoachBatch = asyncHandler(async (req: Request, res: Response) => {
  const coach = await updateBatch(req.vendorId!, req.params.id!, req.params.batchId!, req.body);
  sendSuccess(res, 200, coach, "Batch updated");
});

export const removeVendorCoachBatch = asyncHandler(async (req: Request, res: Response) => {
  const coach = await removeBatch(req.vendorId!, req.params.id!, req.params.batchId!);
  sendSuccess(res, 200, coach, "Batch removed");
});

/* ---- Leaves ---- */
export const addVendorCoachLeave = asyncHandler(async (req: Request, res: Response) => {
  const coach = await addLeave(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 201, coach, "Leave added");
});

export const removeVendorCoachLeave = asyncHandler(async (req: Request, res: Response) => {
  const coach = await removeLeave(req.vendorId!, req.params.id!, req.params.date!);
  sendSuccess(res, 200, coach, "Leave removed");
});

/* ---- Subscriptions (students) ---- */
export const getVendorCoachSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { status, coachId, page, limit } = req.query as unknown as {
    status?: string;
    coachId?: string;
    page: number;
    limit: number;
  };
  const result = await listSubscriptionsForVendor(req.vendorId!, { status, coachId, page, limit });
  sendSuccess(res, 200, result);
});
