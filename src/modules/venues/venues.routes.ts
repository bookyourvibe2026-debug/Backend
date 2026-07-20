import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { availabilityQuerySchema, listingIdParamSchema, publicListingQuerySchema, vendorIdParamSchema } from "../../validators/listing.validators";
import { browseVenues, getVendorProfile, getVenueAvailability, getVenueById } from "./venues.controller";

const router = Router();

router.get("/", validate({ query: publicListingQuerySchema }), browseVenues);
router.get("/vendors/:vendorId", validate({ params: vendorIdParamSchema }), getVendorProfile);
router.get("/:id/availability", validate({ params: listingIdParamSchema, query: availabilityQuerySchema }), getVenueAvailability);
router.get("/:id", validate({ params: listingIdParamSchema }), getVenueById);

export default router;
