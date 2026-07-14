import { Router } from "express";
import { getMpinStatus, setMpin, verifyMpin, requestMpinChange, confirmMpinChange } from "./vendor.mpin.controller";

const router = Router();

router.get("/status", getMpinStatus);
router.post("/set", setMpin);
router.post("/verify", verifyMpin);
router.post("/change/request", requestMpinChange);
router.post("/change/confirm", confirmMpinChange);

export default router;
