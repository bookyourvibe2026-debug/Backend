import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { publicTournamentQuerySchema, tournamentIdParamSchema } from "../../validators/tournament.validators";
import { browseTournaments, getTournamentById } from "./tournaments.controller";

const router = Router();

router.get("/", validate({ query: publicTournamentQuerySchema }), browseTournaments);
router.get("/:id", validate({ params: tournamentIdParamSchema }), getTournamentById);

export default router;
