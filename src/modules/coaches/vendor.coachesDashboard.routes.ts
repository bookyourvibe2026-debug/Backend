import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { getVendorCoachesDashboard } from "./vendor.coachesDashboard.controller";

const router = Router();

router.use(requireVendorVertical("coaches"));

router.get("/", requireVendorPermission("coaches", "view"), getVendorCoachesDashboard);

export default router;
