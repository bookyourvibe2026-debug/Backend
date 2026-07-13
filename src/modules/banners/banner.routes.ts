import { Router } from "express";
import { listActiveBanners } from "./banner.controller";

const router = Router();

router.get("/", listActiveBanners);

export default router;
