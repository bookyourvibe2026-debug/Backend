import { Router } from "express";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createVendorPayoutSchema,
  idParamSchema,
  payoutCategorySchema,
  updateVendorPayoutStatusSchema,
} from "../../validators/admin.validators";
import {
  createPayoutCategory,
  createVendorPayout,
  deletePayoutCategory,
  getVendorPayoutBookings,
  listPayoutCategories,
  listVendorPayouts,
  updateVendorPayoutStatus,
} from "./admin.payouts.controller";

const router = Router();

router.get("/categories", requireAdminPermission("payouts", "view"), listPayoutCategories);
router.post(
  "/categories",
  requireAdminPermission("payouts", "create"),
  validate({ body: payoutCategorySchema }),
  createPayoutCategory
);
router.delete(
  "/categories/:id",
  requireAdminPermission("payouts", "delete"),
  validate({ params: idParamSchema }),
  deletePayoutCategory
);

router.get("/", requireAdminPermission("payouts", "view"), listVendorPayouts);
router.post("/", requireAdminPermission("payouts", "create"), validate({ body: createVendorPayoutSchema }), createVendorPayout);
router.patch(
  "/:id/status",
  requireAdminPermission("payouts", "edit"),
  validate({ params: idParamSchema, body: updateVendorPayoutStatusSchema }),
  updateVendorPayoutStatus
);
router.get("/:id/bookings", requireAdminPermission("payouts", "view"), validate({ params: idParamSchema }), getVendorPayoutBookings);

export default router;
