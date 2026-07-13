import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { getVendorDashboard, getVendorSettledPayments } from "./vendor.dashboard.controller";

const router = Router();

router.use(requireVendorVertical("turf"));

router.get("/", requireVendorPermission("dashboard", "view"), getVendorDashboard);
router.get("/settled-payments", requireVendorPermission("earnings", "view"), getVendorSettledPayments);

export default router;
