import { Router } from "express";
import {
  createVendorCustomSport,
  deleteVendorCustomSport,
  getVendorCustomSports,
  updateVendorCustomSport,
} from "./vendor.customSport.controller";

const router = Router();

router.get("/", getVendorCustomSports);
router.post("/", createVendorCustomSport);
router.put("/:id", updateVendorCustomSport);
router.delete("/:id", deleteVendorCustomSport);

export default router;
