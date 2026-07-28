import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import {
  availabilityQuerySchema,
  listingIdParamSchema,
  publicListingQuerySchema,
  rankingsQuerySchema,
  vendorIdParamSchema,
} from "../../validators/listing.validators";
import { browseVenues, getVendorProfile, getVenueAvailability, getVenueById, getVenueRankings } from "./venues.controller";

const router = Router();

router.get("/", validate({ query: publicListingQuerySchema }), browseVenues);
// Declared before "/:id" — otherwise "rankings" is read as a venue slug.
router.get("/rankings", validate({ query: rankingsQuerySchema }), getVenueRankings);
router.get("/vendors/:vendorId", validate({ params: vendorIdParamSchema }), getVendorProfile);
router.get("/:id/availability", validate({ params: listingIdParamSchema, query: availabilityQuerySchema }), getVenueAvailability);
router.get("/:id", validate({ params: listingIdParamSchema }), getVenueById);

export default router;
