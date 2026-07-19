import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createOutletSchema,
  outletIdParamSchema,
  outletLeaveDateParamSchema,
  outletLeaveSchema,
  outletWeeklyAvailabilitySchema,
  updateOutletSchema,
} from "../../validators/foodOutlet.validators";
import {
  addVendorOutletLeave,
  createVendorOutlet,
  deleteVendorOutlet,
  getVendorOutletById,
  getVendorOutlets,
  removeVendorOutletLeave,
  setVendorOutletAvailability,
  updateVendorOutlet,
} from "./vendor.foodOutlets.controller";

const router = Router();

router.use(requireVendorVertical("food"));

router.get("/", requireVendorPermission("menu", "view"), getVendorOutlets);
router.post("/", requireVendorPermission("menu", "create"), validate({ body: createOutletSchema }), createVendorOutlet);

router.get("/:id", requireVendorPermission("menu", "view"), validate({ params: outletIdParamSchema }), getVendorOutletById);
router.put(
  "/:id",
  requireVendorPermission("menu", "edit"),
  validate({ params: outletIdParamSchema, body: updateOutletSchema }),
  updateVendorOutlet
);
router.delete(
  "/:id",
  requireVendorPermission("menu", "delete"),
  validate({ params: outletIdParamSchema }),
  deleteVendorOutlet
);

router.put(
  "/:id/availability",
  requireVendorPermission("menu", "edit"),
  validate({ params: outletIdParamSchema, body: outletWeeklyAvailabilitySchema }),
  setVendorOutletAvailability
);

router.post(
  "/:id/leaves",
  requireVendorPermission("menu", "edit"),
  validate({ params: outletIdParamSchema, body: outletLeaveSchema }),
  addVendorOutletLeave
);
router.delete(
  "/:id/leaves/:date",
  requireVendorPermission("menu", "edit"),
  validate({ params: outletLeaveDateParamSchema }),
  removeVendorOutletLeave
);

export default router;
