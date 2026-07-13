import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { resolveVendorScope, requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createListingSchema, listingIdParamSchema, updateListingSchema } from "../../validators/listing.validators";
import {
  createVendorListing,
  deleteVendorListing,
  getVendorListingById,
  getVendorListings,
  updateVendorListing,
} from "./vendor.listings.controller";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope, requireVendorVertical("turf"));

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

export default router;
