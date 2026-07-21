import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { challengeCodeParamSchema } from "../../validators/challenge.validators";
import { postCheckInChallenge } from "./challenges.controller";

const router = Router();

router.post("/:code/check-in", validate({ params: challengeCodeParamSchema }), postCheckInChallenge);

export default router;
