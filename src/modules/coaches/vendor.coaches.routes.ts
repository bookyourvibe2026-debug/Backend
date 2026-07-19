import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { resolveVendorScope, requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  addLeaveSchema,
  batchParamSchema,
  coachIdParamSchema,
  createBatchSchema,
  createCoachSchema,
  leaveDateParamSchema,
  subscriptionListQuerySchema,
  updateBatchSchema,
  updateCoachSchema,
  vendorCoachQuerySchema,
  weeklyAvailabilitySchema,
} from "../../validators/coach.validators";
import {
  addVendorCoachBatch,
  addVendorCoachLeave,
  createVendorCoach,
  deleteVendorCoach,
  getVendorCoachById,
  getVendorCoaches,
  getVendorCoachSubscriptions,
  removeVendorCoachBatch,
  removeVendorCoachLeave,
  setVendorCoachAvailability,
  updateVendorCoach,
  updateVendorCoachBatch,
} from "./vendor.coaches.controller";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope, requireVendorVertical("coaches"));

router.get("/", requireVendorPermission("coaches", "view"), validate({ query: vendorCoachQuerySchema }), getVendorCoaches);
router.post("/", requireVendorPermission("coaches", "create"), validate({ body: createCoachSchema }), createVendorCoach);

router.get(
  "/subscriptions",
  requireVendorPermission("coaches", "view"),
  validate({ query: subscriptionListQuerySchema }),
  getVendorCoachSubscriptions
);

router.get("/:id", requireVendorPermission("coaches", "view"), validate({ params: coachIdParamSchema }), getVendorCoachById);
router.put(
  "/:id",
  requireVendorPermission("coaches", "edit"),
  validate({ params: coachIdParamSchema, body: updateCoachSchema }),
  updateVendorCoach
);
router.delete("/:id", requireVendorPermission("coaches", "delete"), validate({ params: coachIdParamSchema }), deleteVendorCoach);

router.put(
  "/:id/availability",
  requireVendorPermission("coaches", "edit"),
  validate({ params: coachIdParamSchema, body: weeklyAvailabilitySchema }),
  setVendorCoachAvailability
);

router.post(
  "/:id/batches",
  requireVendorPermission("coaches", "edit"),
  validate({ params: coachIdParamSchema, body: createBatchSchema }),
  addVendorCoachBatch
);
router.put(
  "/:id/batches/:batchId",
  requireVendorPermission("coaches", "edit"),
  validate({ params: batchParamSchema, body: updateBatchSchema }),
  updateVendorCoachBatch
);
router.delete(
  "/:id/batches/:batchId",
  requireVendorPermission("coaches", "edit"),
  validate({ params: batchParamSchema }),
  removeVendorCoachBatch
);

router.post(
  "/:id/leaves",
  requireVendorPermission("coaches", "edit"),
  validate({ params: coachIdParamSchema, body: addLeaveSchema }),
  addVendorCoachLeave
);
router.delete(
  "/:id/leaves/:date",
  requireVendorPermission("coaches", "edit"),
  validate({ params: leaveDateParamSchema }),
  removeVendorCoachLeave
);

export default router;
