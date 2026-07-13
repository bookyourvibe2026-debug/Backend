import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import adminListingsRoutes from "../listings/admin.listings.routes";
import adminBookingsRoutes from "../bookings/admin.bookings.routes";
import adminAppVersionRoutes from "./admin.appversion.routes";
import adminAppearanceRoutes from "./admin.appearance.routes";
import adminBlogRoutes from "./admin.blog.routes";
import adminBannerRoutes from "./admin.banner.routes";
import adminDashboardRoutes from "./admin.dashboard.routes";
import adminPayoutsRoutes from "./admin.payouts.routes";
import adminSubUsersRoutes from "./admin.subusers.routes";
import adminVendorsRoutes from "./admin.vendors.routes";
import uploadsRoutes from "../uploads/uploads.routes";

const router = Router();

router.use(requireAuth("admin"));

router.use("/dashboard", adminDashboardRoutes);
router.use("/vendors", adminVendorsRoutes);
router.use("/sub-admins", adminSubUsersRoutes);
router.use("/listings", adminListingsRoutes);
router.use("/bookings", adminBookingsRoutes);
router.use("/payouts", adminPayoutsRoutes);
router.use("/blog", adminBlogRoutes);
router.use("/banners", adminBannerRoutes);
router.use("/app-version", adminAppVersionRoutes);
router.use("/appearance", adminAppearanceRoutes);
router.use("/uploads", uploadsRoutes);

export default router;
