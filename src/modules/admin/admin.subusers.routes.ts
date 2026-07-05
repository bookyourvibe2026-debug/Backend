import { Router } from "express";
import { requireRole } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createAdminSubUserSchema, idParamSchema, updateAdminSubUserSchema } from "../../validators/admin.validators";
import {
  createAdminSubUser,
  deleteAdminSubUser,
  listAdminSubUsers,
  updateAdminSubUser,
} from "./admin.subusers.controller";

const router = Router();

// Only the super admin manages sub-admin accounts and their permissions — letting a
// sub-admin edit sub-admins (even via a granted permission) would allow self-escalation.
router.use(requireRole("super_admin"));

router.get("/", listAdminSubUsers);
router.post("/", validate({ body: createAdminSubUserSchema }), createAdminSubUser);
router.put("/:id", validate({ params: idParamSchema, body: updateAdminSubUserSchema }), updateAdminSubUser);
router.delete("/:id", validate({ params: idParamSchema }), deleteAdminSubUser);

export default router;
