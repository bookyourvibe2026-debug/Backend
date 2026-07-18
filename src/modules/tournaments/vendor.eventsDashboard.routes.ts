import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import {
  getVendorEventsDashboard,
  getVendorEventBookings,
  exportVendorEventBookings,
  checkInEventBooking,
  getVendorEventArrivals,
} from "./vendor.eventsDashboard.controller";

const router = Router();

router.use(requireVendorVertical("events"));

router.get("/", requireVendorPermission("tournaments", "view"), getVendorEventsDashboard);
router.get("/bookings", requireVendorPermission("tournaments", "view"), getVendorEventBookings);
router.get("/bookings/export", requireVendorPermission("tournaments", "view"), exportVendorEventBookings);
router.get("/arrivals", requireVendorPermission("tournaments", "view"), getVendorEventArrivals);
router.post("/bookings/:orderId/checkin", requireVendorPermission("tournaments", "edit"), checkInEventBooking);

export default router;
