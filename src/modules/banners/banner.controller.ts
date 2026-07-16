import { Request, Response } from "express";
import { AdBannerModel } from "../../models/AdBanner.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { cached, invalidatePrefix } from "../../utils/cache";

/** Banners render on every home page load and change rarely — a prime caching target. */
const BANNER_CACHE_PREFIX = "banners:";
const BANNER_CACHE_TTL_MS = 60_000; // 60s
const BANNER_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=120";

/** Drop cached banner responses. Called by the admin banner writes. */
export function invalidateBannerCache(): void {
  invalidatePrefix(BANNER_CACHE_PREFIX);
}

export const listActiveBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await cached(`${BANNER_CACHE_PREFIX}active`, BANNER_CACHE_TTL_MS, () =>
    AdBannerModel.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).limit(5)
  );
  res.set("Cache-Control", BANNER_CACHE_CONTROL);
  sendSuccess(res, 200, banners);
});
