import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { findPublicListingById, findPublicListings, findPublicVendorProfile } from "../../services/listing.service";

/** Let the browser/CDN reuse public reads for a short window (matches the in-memory cache TTL). */
const PUBLIC_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";

export const browseVenues = asyncHandler(async (req: Request, res: Response) => {
  const { city, category, subCategory, type, vendorId, search, page, limit } = req.query as unknown as {
    city?: string;
    category?: string;
    subCategory?: string;
    type?: string;
    vendorId?: string;
    search?: string;
    page: number;
    limit: number;
  };

  const result = await findPublicListings({ city, category, subCategory, type, vendorId, search, page, limit });
  res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
  sendSuccess(res, 200, result);
});

export const getVenueById = asyncHandler(async (req: Request, res: Response) => {
  const listing = await findPublicListingById(req.params.id!);
  res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
  sendSuccess(res, 200, listing);
});

export const getVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await findPublicVendorProfile(req.params.vendorId!);
  res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
  sendSuccess(res, 200, profile);
});
