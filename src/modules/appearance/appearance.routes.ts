import { Router } from "express";
import { getSiteAppearance } from "../admin/admin.appearance.controller";

const router = Router();

/** Public — every visitor's browser reads the live site-wide theme from here, no auth required. */
router.get("/", getSiteAppearance);

export default router;
