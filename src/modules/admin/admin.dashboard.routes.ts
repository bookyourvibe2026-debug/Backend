import { Router } from "express";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { getAdminDashboard, getSystemHealth } from "./admin.dashboard.controller";

const router = Router();

router.get("/", requireAdminPermission("dashboard", "view"), getAdminDashboard);
router.get("/system-health", requireAdminPermission("systemHealth", "view"), getSystemHealth);

export default router;
