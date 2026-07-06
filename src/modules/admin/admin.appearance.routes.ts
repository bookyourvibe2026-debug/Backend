import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { siteAppearanceUpdateSchema } from "../../validators/admin.validators";
import { getSiteAppearance, updateSiteAppearance } from "./admin.appearance.controller";

const router = Router();

router.get("/", getSiteAppearance);
router.put("/", validate({ body: siteAppearanceUpdateSchema }), updateSiteAppearance);

export default router;
