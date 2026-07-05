import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createListingForAdmin,
  deleteListingAsAdmin,
  getListingById,
  listAdminListings,
  updateListingAsAdmin,
} from "../../services/listing.service";

export const createAdminListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await createListingForAdmin(req.body);
  sendSuccess(res, 201, listing, "Listing created");
});

export const getAdminListings = asyncHandler(async (req: Request, res: Response) => {
  const listings = await listAdminListings(req.query as { city?: string; type?: string; search?: string });
  sendSuccess(res, 200, listings);
});

export const getAdminListingById = asyncHandler(async (req: Request, res: Response) => {
  const listing = await getListingById(req.params.id!);
  sendSuccess(res, 200, listing);
});

export const updateAdminListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await updateListingAsAdmin(req.params.id!, req.body);
  sendSuccess(res, 200, listing, "Listing updated");
});

export const deleteAdminListing = asyncHandler(async (req: Request, res: Response) => {
  await deleteListingAsAdmin(req.params.id!);
  sendSuccess(res, 200, null, "Listing deleted");
});
