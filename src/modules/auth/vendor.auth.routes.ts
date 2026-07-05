import { Router } from "express";
import { authRateLimiter } from "../../middleware/rateLimit.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { vendorLoginSchema, vendorRegisterSchema } from "../../validators/auth.validators";
import {
  getCurrentVendor,
  loginVendor,
  logoutVendor,
  refreshVendor,
  registerVendor,
} from "./vendor.auth.controller";

const router = Router();

router.post("/register", authRateLimiter, validate({ body: vendorRegisterSchema }), registerVendor);
router.post("/login", authRateLimiter, validate({ body: vendorLoginSchema }), loginVendor);
router.post("/refresh", refreshVendor);
router.post("/logout", logoutVendor);
router.get("/me", requireAuth("vendor"), getCurrentVendor);

export default router;
