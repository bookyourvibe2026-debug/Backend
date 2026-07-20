import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { findPublicListingById, findPublicListings, findPublicVendorProfile } from "../../services/listing.service";
import { getBookedRangesForDate } from "../../services/booking.service";

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

/** Booked (non-cancelled) time ranges for a venue on one date, so the booking
 * flow can grey out slots that are already taken. Deliberately NOT cached —
 * a slot booked seconds ago must show as taken immediately. */
export const getVenueAvailability = asyncHandler(async (req: Request, res: Response) => {
  // Resolve through the listing so slugs work and unknown venues 404 cleanly.
  const listing = await findPublicListingById(req.params.id!);
  const ranges = await getBookedRangesForDate(String(listing._id), req.query.date as string);
  sendSuccess(res, 200, ranges);
});

export const getVendorProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await findPublicVendorProfile(req.params.vendorId!);
  res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
  sendSuccess(res, 200, profile);
});
