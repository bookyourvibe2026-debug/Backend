import { Request, Response } from "express";
import { AdBannerModel } from "../../models/AdBanner.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listActiveBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await AdBannerModel.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).limit(5);
  sendSuccess(res, 200, banners);
});
