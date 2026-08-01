import { Router } from "express";
import { getTopPlayersLeaderboard } from "./leaderboard.controller";

const router = Router();

router.get("/players", getTopPlayersLeaderboard);

export const leaderboardRoutes = router;
