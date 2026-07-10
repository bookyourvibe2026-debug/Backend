import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { listingIdParamSchema, publicListingQuerySchema, vendorIdParamSchema } from "../../validators/listing.validators";
import { browseVenues, getVendorProfile, getVenueById } from "./venues.controller";

const router = Router();

router.get("/", validate({ query: publicListingQuerySchema }), browseVenues);
router.get("/vendors/:vendorId", validate({ params: vendorIdParamSchema }), getVendorProfile);
router.get("/:id", validate({ params: listingIdParamSchema }), getVenueById);

export default router;
