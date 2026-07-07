import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  bookCoachSlotSchema,
  coachBookingListQuerySchema,
  orderIdParamSchema,
} from "../../validators/coach.validators";
import {
  cancelMyCoachBookingRoute,
  createMyCoachBooking,
  getMyCoachBookingByOrderId,
  getMyCoachBookings,
} from "./customer.coaches.controller";

const router = Router();

router.use(requireAuth("customer"));

router.post("/", validate({ body: bookCoachSlotSchema }), createMyCoachBooking);
router.get("/", validate({ query: coachBookingListQuerySchema }), getMyCoachBookings);
router.get("/:orderId", validate({ params: orderIdParamSchema }), getMyCoachBookingByOrderId);
router.post("/:orderId/cancel", validate({ params: orderIdParamSchema }), cancelMyCoachBookingRoute);

export default router;
