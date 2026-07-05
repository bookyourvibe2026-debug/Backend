import { Router } from "express";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createVendorSchema,
  idParamSchema,
  updateVendorSchema,
  vendorListQuerySchema,
  vendorStatusUpdateSchema,
} from "../../validators/admin.validators";
import { createVendor, deleteVendor, getVendorById, listVendors, updateVendor, updateVendorStatus } from "./admin.vendors.controller";

const router = Router();

router.get("/", requireAdminPermission("vendors", "view"), validate({ query: vendorListQuerySchema }), listVendors);
router.get("/:id", requireAdminPermission("vendors", "view"), validate({ params: idParamSchema }), getVendorById);
router.post("/", requireAdminPermission("vendors", "create"), validate({ body: createVendorSchema }), createVendor);
router.put(
  "/:id",
  requireAdminPermission("vendors", "edit"),
  validate({ params: idParamSchema, body: updateVendorSchema }),
  updateVendor
);
router.patch(
  "/:id/status",
  requireAdminPermission("vendors", "edit"),
  validate({ params: idParamSchema, body: vendorStatusUpdateSchema }),
  updateVendorStatus
);
router.delete("/:id", requireAdminPermission("vendors", "delete"), validate({ params: idParamSchema }), deleteVendor);

export default router;
