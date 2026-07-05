import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { findPublicListingById, findPublicListings } from "../../services/listing.service";

export const browseVenues = asyncHandler(async (req: Request, res: Response) => {
  const { city, category, type, search, page, limit } = req.query as unknown as {
    city?: string;
    category?: string;
    type?: string;
    search?: string;
    page: number;
    limit: number;
  };

  const result = await findPublicListings({ city, category, type, search, page, limit });
  sendSuccess(res, 200, result);
});

export const getVenueById = asyncHandler(async (req: Request, res: Response) => {
  const listing = await findPublicListingById(req.params.id!);
  sendSuccess(res, 200, listing);
});
