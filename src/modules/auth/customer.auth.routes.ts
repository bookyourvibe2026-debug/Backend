import { Router } from "express";
import { authRateLimiter } from "../../middleware/rateLimit.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { customerLoginSchema, customerRegisterSchema } from "../../validators/auth.validators";
import {
  getCurrentCustomer,
  loginCustomer,
  logoutCustomer,
  refreshCustomer,
  registerCustomer,
} from "./customer.auth.controller";

const router = Router();

router.post("/register", authRateLimiter, validate({ body: customerRegisterSchema }), registerCustomer);
router.post("/login", authRateLimiter, validate({ body: customerLoginSchema }), loginCustomer);
router.post("/refresh", refreshCustomer);
router.post("/logout", logoutCustomer);
router.get("/me", requireAuth("customer"), getCurrentCustomer);

export default router;
