import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { addVendorVerticalsSchema, updateVendorProfileSchema } from "../../validators/vendor.validators";
import { addVendorVerticals, getVendorProfile, updateVendorProfile } from "./vendor.profile.controller";

const router = Router();

router.get("/", requireVendorPermission("settings", "view"), getVendorProfile);
router.patch("/", requireVendorPermission("settings", "edit"), validate({ body: updateVendorProfileSchema }), updateVendorProfile);
router.post(
  "/verticals",
  requireVendorPermission("settings", "edit"),
  validate({ body: addVendorVerticalsSchema }),
  addVendorVerticals
);

export default router;
