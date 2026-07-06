import { Router } from "express";
import { authRateLimiter, otpRequestRateLimiter } from "../../middleware/rateLimit.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  emailOtpVerifyOnlySchema,
  forgotPasswordSchema,
  requestEmailOtpSchema,
  resetPasswordSchema,
  vendorLoginSchema,
  vendorRegisterSchema,
} from "../../validators/auth.validators";
import {
  forgotVendorPassword,
  getCurrentVendor,
  loginVendor,
  logoutVendor,
  refreshVendor,
  registerVendor,
  requestVendorRegisterOtp,
  resetVendorPassword,
  verifyVendorRegisterOtp,
} from "./vendor.auth.controller";

const router = Router();

router.post("/register", authRateLimiter, validate({ body: vendorRegisterSchema }), registerVendor);
router.post("/login", authRateLimiter, validate({ body: vendorLoginSchema }), loginVendor);
router.post("/register/otp/request", otpRequestRateLimiter, validate({ body: requestEmailOtpSchema }), requestVendorRegisterOtp);
router.post("/register/otp/verify", authRateLimiter, validate({ body: emailOtpVerifyOnlySchema }), verifyVendorRegisterOtp);
router.post("/forgot-password", otpRequestRateLimiter, validate({ body: forgotPasswordSchema }), forgotVendorPassword);
router.post("/reset-password", authRateLimiter, validate({ body: resetPasswordSchema }), resetVendorPassword);
router.post("/refresh", refreshVendor);
router.post("/logout", logoutVendor);
router.get("/me", requireAuth("vendor"), getCurrentVendor);

export default router;
