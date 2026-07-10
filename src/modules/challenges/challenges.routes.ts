import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  challengeCodeParamSchema,
  challengePlayersQuerySchema,
  createChallengeSchema,
} from "../../validators/challenge.validators";
import {
  getChallengeInvite,
  getChallengePlayers,
  postAcceptChallenge,
  postChallenge,
  postRejectChallenge,
} from "./challenges.controller";

const router = Router();

// Public — anyone with the invite link can preview the challenge before logging in.
router.get("/invite/:code", validate({ params: challengeCodeParamSchema }), getChallengeInvite);

router.use(requireAuth("customer"));

router.get("/players", validate({ query: challengePlayersQuerySchema }), getChallengePlayers);
router.post("/", validate({ body: createChallengeSchema }), postChallenge);
router.post("/:code/accept", validate({ params: challengeCodeParamSchema }), postAcceptChallenge);
router.post("/:code/reject", validate({ params: challengeCodeParamSchema }), postRejectChallenge);

export default router;
