import { Router } from "express";
import adminAuthRoutes from "../modules/auth/admin.auth.routes";
import customerAuthRoutes from "../modules/auth/customer.auth.routes";
import vendorAuthRoutes from "../modules/auth/vendor.auth.routes";
import adminRoutes from "../modules/admin/admin.routes";
import appearanceRoutes from "../modules/appearance/appearance.routes";
import blogRoutes from "../modules/blog/blog.routes";
import customerBookingsRoutes from "../modules/bookings/customer.bookings.routes";
import coachesRoutes from "../modules/coaches/coaches.routes";
import customerCoachesRoutes from "../modules/coaches/customer.coaches.routes";
import foodRoutes from "../modules/foodOrders/food.routes";
import tournamentsRoutes from "../modules/tournaments/tournaments.routes";
import customerTournamentsRoutes from "../modules/tournaments/customer.tournaments.routes";
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
router.use("/site-appearance", appearanceRoutes);
router.use("/blog", blogRoutes);
router.use("/bookings", customerBookingsRoutes);
router.use("/coaches", coachesRoutes);
router.use("/coach-bookings", customerCoachesRoutes);
router.use("/tournaments", tournamentsRoutes);
router.use("/tournament-registrations", customerTournamentsRoutes);
router.use("/food", foodRoutes);

router.use("/vendor", vendorRoutes);
router.use("/admin", adminRoutes);

export default router;
