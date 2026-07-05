import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { listingIdParamSchema, publicListingQuerySchema } from "../../validators/listing.validators";
import { browseVenues, getVenueById } from "./venues.controller";

const router = Router();

router.get("/", validate({ query: publicListingQuerySchema }), browseVenues);
router.get("/:id", validate({ params: listingIdParamSchema }), getVenueById);

export default router;
