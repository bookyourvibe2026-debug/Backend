import { Router } from "express";
import { getLastMinuteDeals } from "./deals.controller";

const router = Router();

router.get("/last-minute", getLastMinuteDeals);

export default router;
