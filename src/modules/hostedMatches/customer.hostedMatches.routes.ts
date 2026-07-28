import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  confirmHostPaymentSchema,
  confirmPlayerPaymentSchema,
  createHostedMatchSchema,
  joinHostedMatchSchema,
  respondToParticipantSchema,
} from "../../validators/hostedMatch.validators";
import {
  confirmMyHostPayment,
  confirmMyPlayerPayment,
  createMyHostedMatch,
  getHostedMatchDetails,
  getOpenHostedMatches,
  joinMyHostedMatch,
  respondToMyParticipantRequest,
} from "./customer.hostedMatches.controller";

const router = Router();

// Public open feed for community page
router.get("/feed", getOpenHostedMatches);
router.get("/:id", getHostedMatchDetails);

// Customer authenticated routes
router.use(requireAuth("customer"));

router.post("/", validate({ body: createHostedMatchSchema }), createMyHostedMatch);
router.post("/:id/confirm-host-payment", validate({ body: confirmHostPaymentSchema }), confirmMyHostPayment);
router.post("/:id/join", validate({ body: joinHostedMatchSchema }), joinMyHostedMatch);
router.post("/:id/participants/:participantId/respond", validate({ body: respondToParticipantSchema }), respondToMyParticipantRequest);
router.post("/:id/confirm-player-payment", validate({ body: confirmPlayerPaymentSchema }), confirmMyPlayerPayment);

export default router;
