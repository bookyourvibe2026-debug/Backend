import { Router } from "express";
import {
  trackEvent,
  getAnalyticsSummary,
  getExecutiveDashboard,
  getMarketIntelligence,
  getVendorIntelligence,
} from "./analytics.controller";

const router = Router();

router.post("/track", trackEvent);
router.get("/summary", getAnalyticsSummary);
router.get("/executive-dashboard", getExecutiveDashboard);
router.get("/market-intelligence", getMarketIntelligence);
router.get("/vendor-intelligence", getVendorIntelligence);

export default router;
