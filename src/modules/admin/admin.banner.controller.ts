import { Request, Response } from "express";
import { AdBannerModel } from "../../models/AdBanner.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listAdBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await AdBannerModel.find().sort({ order: 1, createdAt: -1 });
  sendSuccess(res, 200, banners);
});

export const createAdBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await AdBannerModel.create(req.body);
  sendSuccess(res, 201, banner, "Banner created");
});

export const updateAdBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await AdBannerModel.findById(req.params.id!);
  if (!banner) throw ApiError.notFound("Banner not found");
  banner.set(req.body);
  await banner.save();
  sendSuccess(res, 200, banner, "Banner updated");
});

export const deleteAdBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await AdBannerModel.findByIdAndDelete(req.params.id!);
  if (!banner) throw ApiError.notFound("Banner not found");
  sendSuccess(res, 200, null, "Banner deleted");
});
