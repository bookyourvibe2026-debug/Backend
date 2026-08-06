import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import { outletIdParamSchema } from "../../validators/foodOutlet.validators";
import {
  bookingIdParamSchema,
  outletDineoutSchema,
  updateBookingStatusSchema,
  vendorBillListQuerySchema,
  vendorBookingListQuerySchema,
} from "../../validators/dineout.validators";
import {
  checkInVendorTableBooking,
  getVendorDineoutDashboard,
  getVendorDiningBills,
  getVendorTableBooking,
  getVendorTableBookings,
  setVendorOutletDineout,
  updateVendorTableBookingStatus,
} from "./vendor.dineout.controller";

const router = Router();

router.use(requireVendorVertical("food"));

router.get("/dashboard", requireVendorPermission("foodOrders", "view"), getVendorDineoutDashboard);

router.get(
  "/bills",
  requireVendorPermission("foodOrders", "view"),
  validate({ query: vendorBillListQuerySchema }),
  getVendorDiningBills
);

router.put(
  "/outlets/:id/settings",
  requireVendorPermission("menu", "edit"),
  validate({ params: outletIdParamSchema, body: outletDineoutSchema }),
  setVendorOutletDineout
);

router.get(
  "/bookings",
  requireVendorPermission("foodOrders", "view"),
  validate({ query: vendorBookingListQuerySchema }),
  getVendorTableBookings
);
router.get(
  "/bookings/:bookingId",
  requireVendorPermission("foodOrders", "view"),
  validate({ params: bookingIdParamSchema }),
  getVendorTableBooking
);
router.patch(
  "/bookings/:bookingId/status",
  requireVendorPermission("foodOrders", "edit"),
  validate({ params: bookingIdParamSchema, body: updateBookingStatusSchema }),
  updateVendorTableBookingStatus
);
router.post(
  "/bookings/:bookingId/checkin",
  requireVendorPermission("foodOrders", "edit"),
  validate({ params: bookingIdParamSchema }),
  checkInVendorTableBooking
);

export default router;
