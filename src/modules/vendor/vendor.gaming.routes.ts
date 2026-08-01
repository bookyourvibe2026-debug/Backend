import { Router } from "express";
import {
  getGamingSessions,
  createGamingSession,
  completeGamingSession,
} from "./vendor.gaming.controller";

const router = Router();

router.get("/", getGamingSessions);
router.post("/", createGamingSession);
router.post("/:id/complete", completeGamingSession);

export default router;
