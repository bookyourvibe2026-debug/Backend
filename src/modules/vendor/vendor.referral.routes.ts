import { Router } from "express";
import { getVendorReferralCode } from "./vendor.referral.controller";

const router = Router();

router.get("/code", getVendorReferralCode);

export default router;
