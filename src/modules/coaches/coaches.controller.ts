import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPublicCoachById, listPublicCoaches } from "../../services/coach.service";

export const browseCoaches = asyncHandler(async (req: Request, res: Response) => {
  const { category, vendorId, page, limit } = req.query as unknown as {
    category?: string;
    vendorId?: string;
    page: number;
    limit: number;
  };

  const result = await listPublicCoaches({ category, vendorId, page, limit });
  sendSuccess(res, 200, result);
});

export const getCoachById = asyncHandler(async (req: Request, res: Response) => {
  const coach = await getPublicCoachById(req.params.id!);
  sendSuccess(res, 200, coach);
});
