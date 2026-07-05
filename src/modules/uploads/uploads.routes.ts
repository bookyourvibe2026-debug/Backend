import { Router } from "express";
import { uploadImage, uploadImageMiddleware } from "./uploads.controller";

const router = Router();

router.post("/", uploadImageMiddleware, uploadImage);

export default router;
