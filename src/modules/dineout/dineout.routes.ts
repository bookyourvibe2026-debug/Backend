import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  billIdParamSchema,
  bookingIdParamSchema,
  createTableBookingSchema,
  myBookingsQuerySchema,
  payDiningBillSchema,
  quoteDiningBillSchema,
  slotsParamSchema,
  slotsQuerySchema,
} from "../../validators/dineout.validators";
import {
  bookTable,
  cancelMyTableBooking,
  getBillQuote,
  getMyBill,
  getMyBills,
  getMyTableBooking,
  getMyTableBookings,
  getSlots,
  payBill,
} from "./dineout.controller";

const router = Router();

// Public — browse availability and price a bill without signing in.
router.get("/outlets/:id/slots", validate({ params: slotsParamSchema, query: slotsQuerySchema }), getSlots);
router.post("/bills/quote", validate({ body: quoteDiningBillSchema }), getBillQuote);

// Table bookings — customer only.
router.post("/bookings", requireAuth("customer"), validate({ body: createTableBookingSchema }), bookTable);
router.get("/bookings/mine", requireAuth("customer"), validate({ query: myBookingsQuerySchema }), getMyTableBookings);
router.get(
  "/bookings/:bookingId",
  requireAuth("customer"),
  validate({ params: bookingIdParamSchema }),
  getMyTableBooking
);
router.post(
  "/bookings/:bookingId/cancel",
  requireAuth("customer"),
  validate({ params: bookingIdParamSchema }),
  cancelMyTableBooking
);

// Bill payment — customer only.
router.post("/bills", requireAuth("customer"), validate({ body: payDiningBillSchema }), payBill);
router.get("/bills/mine", requireAuth("customer"), validate({ query: myBookingsQuerySchema }), getMyBills);
router.get("/bills/:billId", requireAuth("customer"), validate({ params: billIdParamSchema }), getMyBill);

export default router;
