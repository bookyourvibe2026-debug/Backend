import { Router } from "express";
import { authRateLimiter, otpRequestRateLimiter } from "../../middleware/rateLimit.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  customerGoogleAuthSchema,
  customerLoginSchema,
  customerRegisterSchema,
  emailOtpLoginSchema,
  forgotPasswordSchema,
  requestEmailOtpSchema,
  resetPasswordSchema,
  updateCustomerProfileSchema,
} from "../../validators/auth.validators";
import {
  forgotCustomerPassword,
  getCurrentCustomer,
  googleAuthCustomer,
  loginCustomer,
  loginCustomerWithOtp,
  logoutCustomer,
  refreshCustomer,
  registerCustomer,
  requestCustomerLoginOtp,
  resetCustomerPassword,
  updateMyProfile,
} from "./customer.auth.controller";
import uploadsRoutes from "../uploads/uploads.routes";

const router = Router();

router.post("/register", authRateLimiter, validate({ body: customerRegisterSchema }), registerCustomer);
router.post("/login", authRateLimiter, validate({ body: customerLoginSchema }), loginCustomer);
router.post("/google", authRateLimiter, validate({ body: customerGoogleAuthSchema }), googleAuthCustomer);
router.post("/otp/request", otpRequestRateLimiter, validate({ body: requestEmailOtpSchema }), requestCustomerLoginOtp);
router.post("/otp/login", authRateLimiter, validate({ body: emailOtpLoginSchema }), loginCustomerWithOtp);
router.post("/forgot-password", otpRequestRateLimiter, validate({ body: forgotPasswordSchema }), forgotCustomerPassword);
router.post("/reset-password", authRateLimiter, validate({ body: resetPasswordSchema }), resetCustomerPassword);
router.post("/refresh", refreshCustomer);
router.post("/logout", logoutCustomer);
router.get("/me", requireAuth("customer"), getCurrentCustomer);
router.patch("/me", requireAuth("customer"), validate({ body: updateCustomerProfileSchema }), updateMyProfile);
router.use("/uploads", requireAuth("customer"), uploadsRoutes);

export default router;
