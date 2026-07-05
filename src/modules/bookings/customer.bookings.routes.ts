import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { bookingListQuerySchema, createBookingSchema, orderIdParamSchema } from "../../validators/booking.validators";
import { cancelMyBooking, createMyBooking, getMyBookingByOrderId, getMyBookings } from "./customer.bookings.controller";

const router = Router();

router.use(requireAuth("customer"));

router.post("/", validate({ body: createBookingSchema }), createMyBooking);
router.get("/", validate({ query: bookingListQuerySchema }), getMyBookings);
router.get("/:orderId", validate({ params: orderIdParamSchema }), getMyBookingByOrderId);
router.post("/:orderId/cancel", validate({ params: orderIdParamSchema }), cancelMyBooking);

export default router;
