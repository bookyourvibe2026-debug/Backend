import { Router } from "express";
import { requireVendorPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createMenuItemSchema, menuItemIdParamSchema, updateMenuItemSchema } from "../../validators/vendor.validators";
import { createMenuItem, deleteMenuItem, listMenuItems, updateMenuItem } from "./vendor.menu.controller";

const router = Router();

router.get("/", requireVendorPermission("menu", "view"), listMenuItems);
router.post("/", requireVendorPermission("menu", "create"), validate({ body: createMenuItemSchema }), createMenuItem);
router.put(
  "/:id",
  requireVendorPermission("menu", "edit"),
  validate({ params: menuItemIdParamSchema, body: updateMenuItemSchema }),
  updateMenuItem
);
router.delete("/:id", requireVendorPermission("menu", "delete"), validate({ params: menuItemIdParamSchema }), deleteMenuItem);

export default router;
