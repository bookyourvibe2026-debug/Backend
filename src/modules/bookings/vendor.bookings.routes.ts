import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { resolveVendorScope, requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import { bookingListQuerySchema, createManualBookingSchema, orderIdParamSchema, updateBookingStatusSchema } from "../../validators/booking.validators";
import {
  checkInVendorBooking,
  createVendorBooking,
  getVendorBookingByOrderId,
  getVendorBookings,
  updateVendorBookingStatus,
  exportBookingsToExcel,
} from "./vendor.bookings.controller";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope, requireVendorVertical("turf"));

router.get("/", requireVendorPermission("bookings", "view"), validate({ query: bookingListQuerySchema }), getVendorBookings);
router.get("/export", requireVendorPermission("bookings", "view"), exportBookingsToExcel);
router.post("/", requireVendorPermission("bookings", "create"), validate({ body: createManualBookingSchema }), createVendorBooking);
router.get(
  "/:orderId",
  requireVendorPermission("bookings", "view"),
  validate({ params: orderIdParamSchema }),
  getVendorBookingByOrderId
);
router.patch(
  "/:orderId/status",
  requireVendorPermission("bookings", "edit"),
  validate({ params: orderIdParamSchema, body: updateBookingStatusSchema }),
  updateVendorBookingStatus
);
router.post(
  "/:orderId/checkin",
  requireVendorPermission("bookings", "edit"),
  validate({ params: orderIdParamSchema }),
  checkInVendorBooking
);

export default router;
