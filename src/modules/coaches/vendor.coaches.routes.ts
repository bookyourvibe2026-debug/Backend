import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { resolveVendorScope, requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  addSlotSchema,
  coachBookingListQuerySchema,
  coachIdParamSchema,
  coachSlotParamSchema,
  createCoachSchema,
  orderIdParamSchema,
  updateCoachSchema,
  vendorCoachQuerySchema,
} from "../../validators/coach.validators";
import {
  addVendorCoachSlot,
  checkInVendorCoachBooking,
  createVendorCoach,
  deleteVendorCoach,
  getVendorCoachBookings,
  getVendorCoachById,
  getVendorCoaches,
  removeVendorCoachSlot,
  updateVendorCoach,
} from "./vendor.coaches.controller";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope, requireVendorVertical("coaches"));

router.get("/", requireVendorPermission("coaches", "view"), validate({ query: vendorCoachQuerySchema }), getVendorCoaches);
router.post("/", requireVendorPermission("coaches", "create"), validate({ body: createCoachSchema }), createVendorCoach);

router.get(
  "/bookings",
  requireVendorPermission("coaches", "view"),
  validate({ query: coachBookingListQuerySchema }),
  getVendorCoachBookings
);
router.post(
  "/bookings/:orderId/checkin",
  requireVendorPermission("coaches", "edit"),
  validate({ params: orderIdParamSchema }),
  checkInVendorCoachBooking
);

router.get("/:id", requireVendorPermission("coaches", "view"), validate({ params: coachIdParamSchema }), getVendorCoachById);
router.put("/:id", requireVendorPermission("coaches", "edit"), validate({ params: coachIdParamSchema, body: updateCoachSchema }), updateVendorCoach);
router.delete("/:id", requireVendorPermission("coaches", "delete"), validate({ params: coachIdParamSchema }), deleteVendorCoach);

router.post(
  "/:id/slots",
  requireVendorPermission("coaches", "edit"),
  validate({ params: coachIdParamSchema, body: addSlotSchema }),
  addVendorCoachSlot
);
router.delete(
  "/:id/slots/:slotId",
  requireVendorPermission("coaches", "edit"),
  validate({ params: coachSlotParamSchema }),
  removeVendorCoachSlot
);

export default router;
