import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { coachIdParamSchema, publicCoachQuerySchema } from "../../validators/coach.validators";
import { browseCoaches, getCoachById } from "./coaches.controller";

const router = Router();

router.get("/", validate({ query: publicCoachQuerySchema }), browseCoaches);
router.get("/:id", validate({ params: coachIdParamSchema }), getCoachById);

export default router;
