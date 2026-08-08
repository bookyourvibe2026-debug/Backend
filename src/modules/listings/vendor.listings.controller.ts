import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createListingForVendor,
  deleteListingScopedToVendor,
  getListingScopedToVendor,
  listVendorListings,
  updateListingScopedToVendor,
} from "../../services/listing.service";
import { createAcademyForTurf } from "../../services/coach.service";

export const createVendorListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await createListingForVendor(req.vendorId!, req.body.ownerName, req.body);
  sendSuccess(res, 201, listing, "Listing created");
});

export const getVendorListings = asyncHandler(async (req: Request, res: Response) => {
  const listings = await listVendorListings(req.vendorId!, req.query as { type?: string; search?: string; category?: string });
  sendSuccess(res, 200, listings);
});

export const getVendorListingById = asyncHandler(async (req: Request, res: Response) => {
  const listing = await getListingScopedToVendor(req.params.id!, req.vendorId!);
  sendSuccess(res, 200, listing);
});

export const updateVendorListing = asyncHandler(async (req: Request, res: Response) => {
  const listing = await updateListingScopedToVendor(req.params.id!, req.vendorId!, req.body);
  sendSuccess(res, 200, listing, "Listing updated");
});

export const deleteVendorListing = asyncHandler(async (req: Request, res: Response) => {
  await deleteListingScopedToVendor(req.params.id!, req.vendorId!);
  sendSuccess(res, 200, null, "Listing deleted");
});

/** Add an academy at this turf — available to any Turf vendor, not gated behind the
 * separate Coaches vertical (that gate exists for the standalone Coaches module). */
export const addAcademyToVendorListing = asyncHandler(async (req: Request, res: Response) => {
  const coach = await createAcademyForTurf(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 201, coach, "Academy added");
});
