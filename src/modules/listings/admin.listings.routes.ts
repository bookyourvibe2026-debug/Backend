import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createListingSchema, listingIdParamSchema, updateListingSchema } from "../../validators/listing.validators";
import {
  createAdminListing,
  deleteAdminListing,
  getAdminListingById,
  getAdminListings,
  updateAdminListing,
} from "./admin.listings.controller";

const router = Router();

router.use(requireAuth("admin"));

router.get("/", requireAdminPermission("listings", "view"), getAdminListings);
router.get("/:id", requireAdminPermission("listings", "view"), validate({ params: listingIdParamSchema }), getAdminListingById);
router.post("/", requireAdminPermission("listings", "create"), validate({ body: createListingSchema }), createAdminListing);
router.put(
  "/:id",
  requireAdminPermission("listings", "edit"),
  validate({ params: listingIdParamSchema, body: updateListingSchema }),
  updateAdminListing
);
router.delete("/:id", requireAdminPermission("listings", "delete"), validate({ params: listingIdParamSchema }), deleteAdminListing);

export default router;
