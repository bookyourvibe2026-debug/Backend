import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { bookingListQuerySchema, confirmPaymentSchema, createBookingSchema, orderIdParamSchema } from "../../validators/booking.validators";
import { cancelMyBooking, confirmMyBookingPayment, createMyBooking, getMyBookingByOrderId, getMyBookings } from "./customer.bookings.controller";

const router = Router();

router.use(requireAuth("customer"));

router.post("/", validate({ body: createBookingSchema }), createMyBooking);
router.post("/:orderId/confirm-payment", validate({ params: orderIdParamSchema, body: confirmPaymentSchema }), confirmMyBookingPayment);
router.get("/", validate({ query: bookingListQuerySchema }), getMyBookings);
router.get("/:orderId", validate({ params: orderIdParamSchema }), getMyBookingByOrderId);
router.post("/:orderId/cancel", validate({ params: orderIdParamSchema }), cancelMyBooking);

export default router;
