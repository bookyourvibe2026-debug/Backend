import { Router } from "express";
import { authRateLimiter } from "../../middleware/rateLimit.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { adminLoginSchema } from "../../validators/auth.validators";
import { getCurrentAdmin, loginAdmin, logoutAdmin, refreshAdmin } from "./admin.auth.controller";

const router = Router();

router.post("/login", authRateLimiter, validate({ body: adminLoginSchema }), loginAdmin);
router.post("/refresh", refreshAdmin);
router.post("/logout", logoutAdmin);
router.get("/me", requireAuth("admin"), getCurrentAdmin);

export default router;
