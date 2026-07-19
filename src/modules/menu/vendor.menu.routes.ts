import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { requireVendorVertical } from "../../middleware/vendorScope.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createMenuItemSchema,
  menuItemIdParamSchema,
  menuListQuerySchema,
  updateMenuItemSchema,
} from "../../validators/vendor.validators";
import {
  bulkUploadMenuItems,
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  menuSheetUploadMiddleware,
  updateMenuItem,
} from "./vendor.menu.controller";

const router = Router();

router.use(requireVendorVertical("food"));

router.get("/", requireVendorPermission("menu", "view"), validate({ query: menuListQuerySchema }), listMenuItems);
router.post("/", requireVendorPermission("menu", "create"), validate({ body: createMenuItemSchema }), createMenuItem);
router.post(
  "/bulk-upload/:outletId",
  requireVendorPermission("menu", "create"),
  menuSheetUploadMiddleware,
  bulkUploadMenuItems
);
router.put(
  "/:id",
  requireVendorPermission("menu", "edit"),
  validate({ params: menuItemIdParamSchema, body: updateMenuItemSchema }),
  updateMenuItem
);
router.delete("/:id", requireVendorPermission("menu", "delete"), validate({ params: menuItemIdParamSchema }), deleteMenuItem);

export default router;
