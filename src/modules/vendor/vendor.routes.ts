import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveVendorScope } from "../../middleware/vendorScope.middleware";
import vendorListingsRoutes from "../listings/vendor.listings.routes";
import vendorBookingsRoutes from "../bookings/vendor.bookings.routes";
import vendorCoachesRoutes from "../coaches/vendor.coaches.routes";
import vendorTournamentsRoutes from "../tournaments/vendor.tournaments.routes";
import vendorMenuRoutes from "../menu/vendor.menu.routes";
import vendorFoodOrdersRoutes from "../foodOrders/vendor.foodOrders.routes";
import vendorFoodDashboardRoutes from "../foodOrders/vendor.foodDashboard.routes";
import vendorDashboardRoutes from "./vendor.dashboard.routes";
import vendorMembershipRoutes from "./vendor.membership.routes";
import vendorProfileRoutes from "./vendor.profile.routes";
import vendorStaffRoutes from "./vendor.staff.routes";
import uploadsRoutes from "../uploads/uploads.routes";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope);

router.use("/dashboard", vendorDashboardRoutes);
router.use("/profile", vendorProfileRoutes);
router.use("/staff", vendorStaffRoutes);
router.use("/listings", vendorListingsRoutes);
router.use("/bookings", vendorBookingsRoutes);
router.use("/coaches", vendorCoachesRoutes);
router.use("/tournaments", vendorTournamentsRoutes);
router.use("/memberships", vendorMembershipRoutes);
router.use("/menu", vendorMenuRoutes);
router.use("/food-orders", vendorFoodOrdersRoutes);
router.use("/food-dashboard", vendorFoodDashboardRoutes);
router.use("/uploads", uploadsRoutes);

export default router;
