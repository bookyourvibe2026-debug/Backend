import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveVendorScope } from "../../middleware/vendorScope.middleware";
import vendorListingsRoutes from "../listings/vendor.listings.routes";
import vendorBookingsRoutes from "../bookings/vendor.bookings.routes";
import vendorCoachesRoutes from "../coaches/vendor.coaches.routes";
import vendorTournamentsRoutes from "../tournaments/vendor.tournaments.routes";
import vendorMenuRoutes from "../menu/vendor.menu.routes";
import vendorFoodOutletsRoutes from "../foodOutlets/vendor.foodOutlets.routes";
import vendorFoodOrdersRoutes from "../foodOrders/vendor.foodOrders.routes";
import vendorFoodDashboardRoutes from "../foodOrders/vendor.foodDashboard.routes";
import vendorEventsDashboardRoutes from "../tournaments/vendor.eventsDashboard.routes";
import vendorCoachesDashboardRoutes from "../coaches/vendor.coachesDashboard.routes";
import vendorDashboardRoutes from "./vendor.dashboard.routes";
import vendorExpenseRoutes from "./vendor.expense.routes";
import vendorMembershipRoutes from "./vendor.membership.routes";
import vendorProfileRoutes from "./vendor.profile.routes";
import vendorStaffRoutes from "./vendor.staff.routes";
import vendorMpinRoutes from "./vendor.mpin.routes";
import uploadsRoutes from "../uploads/uploads.routes";

const router = Router();

router.use(requireAuth("vendor"), resolveVendorScope);

router.use("/dashboard", vendorDashboardRoutes);
router.use("/expenses", vendorExpenseRoutes);
router.use("/profile", vendorProfileRoutes);
router.use("/staff", vendorStaffRoutes);
router.use("/mpin", vendorMpinRoutes);
router.use("/listings", vendorListingsRoutes);
router.use("/bookings", vendorBookingsRoutes);
router.use("/coaches", vendorCoachesRoutes);
router.use("/tournaments", vendorTournamentsRoutes);
router.use("/memberships", vendorMembershipRoutes);
router.use("/menu", vendorMenuRoutes);
router.use("/food-outlets", vendorFoodOutletsRoutes);
router.use("/food-orders", vendorFoodOrdersRoutes);
router.use("/food-dashboard", vendorFoodDashboardRoutes);
router.use("/events-dashboard", vendorEventsDashboardRoutes);
router.use("/coaches-dashboard", vendorCoachesDashboardRoutes);
router.use("/uploads", uploadsRoutes);

export default router;
