import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { getVendorEventsDashboard } from "./vendor.eventsDashboard.controller";

const router = Router();

router.use(requireVendorVertical("events"));

router.get("/", requireVendorPermission("tournaments", "view"), getVendorEventsDashboard);

export default router;
