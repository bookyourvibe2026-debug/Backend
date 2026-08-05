import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { findPublicListingById, findPublicListings, findPublicVendorProfile, findVenueRankings, invalidatePublicListingCache } from "../../services/listing.service";
import { getBookedRangesForDate } from "../../services/booking.service";
import { ReviewModel } from "../../models/Review.model";
import { ListingModel } from "../../models/Listing.model";

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

/** Top venues in a city by booking volume — powers the home page's city ranking card. */
export const getVenueRankings = asyncHandler(async (req: Request, res: Response) => {
  const { city, area, limit, days } = req.query as unknown as {
    city: string;
    area?: string;
    limit: number;
    days?: number;
  };

  const result = await findVenueRankings({ city, area, limit, days });
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

export const getVenueReviews = asyncHandler(async (req: Request, res: Response) => {
  const listing = await findPublicListingById(req.params.id!);
  const reviews = await ReviewModel.find({ listingId: listing._id }).sort({ createdAt: -1 }).lean();
  sendSuccess(res, 200, reviews);
});

export const addVenueReview = asyncHandler(async (req: Request, res: Response) => {
  const listing = await findPublicListingById(req.params.id!);
  const { customerName, rating, comment } = req.body;

  const review = await ReviewModel.create({
    listingId: listing._id,
    customerName,
    rating,
    comment,
  });

  // Calculate new stats
  const stats = await ReviewModel.aggregate([
    { $match: { listingId: listing._id } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const avgRating = stats[0] ? Math.round(stats[0].avgRating * 10) / 10 : 0;
  const totalReviews = stats[0] ? stats[0].totalReviews : 0;

  await ListingModel.updateOne(
    { _id: listing._id },
    { rating: avgRating, reviewCount: totalReviews }
  );

  invalidatePublicListingCache();

  sendSuccess(res, 201, review);
});
