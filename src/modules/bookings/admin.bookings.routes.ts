import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { bookingListQuerySchema, orderIdParamSchema, updateBookingStatusSchema } from "../../validators/booking.validators";
import { getAdminBookingByOrderId, getAdminBookings, updateAdminBookingStatus } from "./admin.bookings.controller";

const router = Router();

router.use(requireAuth("admin"));

router.get("/", requireAdminPermission("bookings", "view"), validate({ query: bookingListQuerySchema }), getAdminBookings);
router.get(
  "/:orderId",
  requireAdminPermission("bookings", "view"),
  validate({ params: orderIdParamSchema }),
  getAdminBookingByOrderId
);
router.patch(
  "/:orderId/status",
  requireAdminPermission("bookings", "edit"),
  validate({ params: orderIdParamSchema, body: updateBookingStatusSchema }),
  updateAdminBookingStatus
);

export default router;
