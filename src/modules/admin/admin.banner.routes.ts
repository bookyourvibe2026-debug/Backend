import { Router } from "express";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createAdBannerSchema, idParamSchema, updateAdBannerSchema } from "../../validators/admin.validators";
import { createAdBanner, deleteAdBanner, listAdBanners, updateAdBanner } from "./admin.banner.controller";

const router = Router();

router.get("/", requireAdminPermission("banners", "view"), listAdBanners);
router.post("/", requireAdminPermission("banners", "create"), validate({ body: createAdBannerSchema }), createAdBanner);
router.put(
  "/:id",
  requireAdminPermission("banners", "edit"),
  validate({ params: idParamSchema, body: updateAdBannerSchema }),
  updateAdBanner
);
router.delete("/:id", requireAdminPermission("banners", "delete"), validate({ params: idParamSchema }), deleteAdBanner);

export default router;
