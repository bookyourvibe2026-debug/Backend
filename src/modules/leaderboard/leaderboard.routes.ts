import { Router } from "express";
import { getTopPlayersLeaderboard, getMyPlayerRank } from "./leaderboard.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

router.get("/players", getTopPlayersLeaderboard);
router.get("/players/me", requireAuth("customer"), getMyPlayerRank);

export const leaderboardRoutes = router;
