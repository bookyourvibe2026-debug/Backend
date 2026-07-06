import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { getVendorFoodDashboard } from "./vendor.foodDashboard.controller";

const router = Router();

router.get("/", requireVendorPermission("dashboard", "view"), getVendorFoodDashboard);

export default router;
