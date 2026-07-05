import { Router } from "express";
import adminAuthRoutes from "../modules/auth/admin.auth.routes";
import customerAuthRoutes from "../modules/auth/customer.auth.routes";
import vendorAuthRoutes from "../modules/auth/vendor.auth.routes";
import adminRoutes from "../modules/admin/admin.routes";
import blogRoutes from "../modules/blog/blog.routes";
import customerBookingsRoutes from "../modules/bookings/customer.bookings.routes";
import vendorRoutes from "../modules/vendor/vendor.routes";
import venuesRoutes from "../modules/venues/venues.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "OK", data: { timestamp: new Date().toISOString() } });
});

router.use("/auth/customer", customerAuthRoutes);
router.use("/auth/vendor", vendorAuthRoutes);
router.use("/auth/admin", adminAuthRoutes);

router.use("/venues", venuesRoutes);
router.use("/blog", blogRoutes);
router.use("/bookings", customerBookingsRoutes);

router.use("/vendor", vendorRoutes);
router.use("/admin", adminRoutes);

export default router;
