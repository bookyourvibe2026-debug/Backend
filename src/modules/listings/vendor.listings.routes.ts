import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { resolveVendorScope, requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createListingSchema, listingIdParamSchema, updateListingSchema } from "../../validators/listing.validators";
import { createCoachSchema } from "../../validators/coach.validators";
import {
  addAcademyToVendorListing,
  createVendorListing,
  deleteVendorListing,
  getVendorListingById,
  getVendorListings,
  updateVendorListing,
} from "./vendor.listings.controller";

const router = Router();

// Turf vendors manage Turf/Game listings; events organizers manage Event listings here too.
router.use(requireAuth("vendor"), resolveVendorScope, requireVendorVertical("turf", "events"));

router.get("/", requireVendorPermission("listings", "view"), getVendorListings);
router.get("/:id", requireVendorPermission("listings", "view"), validate({ params: listingIdParamSchema }), getVendorListingById);
router.post("/", requireVendorPermission("listings", "create"), validate({ body: createListingSchema }), createVendorListing);
router.put(
  "/:id",
  requireVendorPermission("listings", "edit"),
  validate({ params: listingIdParamSchema, body: updateListingSchema }),
  updateVendorListing
);
router.delete("/:id", requireVendorPermission("listings", "delete"), validate({ params: listingIdParamSchema }), deleteVendorListing);

// Adding an academy is part of managing the turf itself (that's the whole point of
// offering it inline in "Add Turf"), so it only needs listings:edit — not the
// separate Coaches vertical gate that the standalone /vendor/coaches module requires.
router.post(
  "/:id/academy",
  requireVendorPermission("listings", "edit"),
  validate({ params: listingIdParamSchema, body: createCoachSchema }),
  addAcademyToVendorListing
);

export default router;
