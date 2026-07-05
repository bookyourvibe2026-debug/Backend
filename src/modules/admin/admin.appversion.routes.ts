import { Router } from "express";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { appVersionUpsertSchema } from "../../validators/admin.validators";
import { listAppVersions, upsertAppVersion } from "./admin.appversion.controller";

const router = Router();

router.get("/", requireAdminPermission("appVersion", "view"), listAppVersions);
router.put("/", requireAdminPermission("appVersion", "edit"), validate({ body: appVersionUpsertSchema }), upsertAppVersion);

export default router;
