import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createVendorStaffSchema, staffIdParamSchema, updateVendorStaffSchema } from "../../validators/vendor.validators";
import { createVendorStaff, deleteVendorStaff, listVendorStaff, updateVendorStaff } from "./vendor.staff.controller";

const router = Router();

router.get("/", requireVendorPermission("settings", "view"), listVendorStaff);
router.post("/", requireVendorPermission("settings", "create"), validate({ body: createVendorStaffSchema }), createVendorStaff);
router.put(
  "/:id",
  requireVendorPermission("settings", "edit"),
  validate({ params: staffIdParamSchema, body: updateVendorStaffSchema }),
  updateVendorStaff
);
router.delete("/:id", requireVendorPermission("settings", "delete"), validate({ params: staffIdParamSchema }), deleteVendorStaff);

export default router;
