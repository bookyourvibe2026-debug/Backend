import { Request, Response } from "express";
import { CustomSportModel } from "../../models/CustomSport.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

const PREDEFINED_SPORTS = [
  "cricket", "football", "badminton", "pickleball", "tennis",
  "table tennis", "basketball", "volleyball", "swimming",
  "snooker & pool", "skating", "indoor games"
];

export const getVendorCustomSports = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId;
  if (!vendorId) throw new ApiError(401, "Unauthorized");

  const sports = await CustomSportModel.find({ createdBy: vendorId, isActive: true }).sort({ createdAt: -1 });
  sendSuccess(res, 200, sports, "Custom sports retrieved successfully");
});

export const createVendorCustomSport = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId;
  if (!vendorId) throw new ApiError(401, "Unauthorized");

  const { sportName, iconUrl, venue = "both" } = req.body || {};

  if (!sportName || typeof sportName !== "string" || !sportName.trim()) {
    throw new ApiError(400, "Sport name is required");
  }
  if (!iconUrl || typeof iconUrl !== "string" || !iconUrl.trim()) {
    throw new ApiError(400, "Sport icon or image is required");
  }

  const trimmedName = sportName.trim();
  const lowerName = trimmedName.toLowerCase();

  // Check duplicate against predefined sports
  if (PREDEFINED_SPORTS.includes(lowerName)) {
    throw new ApiError(400, `A built-in sport named "${trimmedName}" already exists.`);
  }

  // Check duplicate against vendor's existing custom sports
  const existing = await CustomSportModel.findOne({
    createdBy: vendorId,
    isActive: true,
    sportName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });

  if (existing) {
    throw new ApiError(400, `A custom sport named "${trimmedName}" already exists.`);
  }

  const sport = await CustomSportModel.create({
    sportName: trimmedName,
    iconUrl: iconUrl.trim(),
    createdBy: vendorId,
    venue: ["indoor", "outdoor", "both"].includes(venue) ? venue : "both",
    isActive: true,
  });

  sendSuccess(res, 201, sport, "New sport added successfully.");
});

export const updateVendorCustomSport = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId;
  if (!vendorId) throw new ApiError(401, "Unauthorized");

  const { id } = req.params;
  const { sportName, iconUrl, venue } = req.body || {};

  const sport = await CustomSportModel.findOne({ _id: id, createdBy: vendorId, isActive: true });
  if (!sport) {
    throw new ApiError(404, "Custom sport not found");
  }

  if (sportName && typeof sportName === "string" && sportName.trim()) {
    const trimmedName = sportName.trim();
    const lowerName = trimmedName.toLowerCase();

    if (PREDEFINED_SPORTS.includes(lowerName)) {
      throw new ApiError(400, `A built-in sport named "${trimmedName}" already exists.`);
    }

    const duplicate = await CustomSportModel.findOne({
      _id: { $ne: id },
      createdBy: vendorId,
      isActive: true,
      sportName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (duplicate) {
      throw new ApiError(400, `A custom sport named "${trimmedName}" already exists.`);
    }

    sport.sportName = trimmedName;
  }

  if (iconUrl && typeof iconUrl === "string" && iconUrl.trim()) {
    sport.iconUrl = iconUrl.trim();
  }

  if (venue && ["indoor", "outdoor", "both"].includes(venue)) {
    sport.venue = venue;
  }

  await sport.save();

  sendSuccess(res, 200, sport, "Sport updated successfully.");
});

export const deleteVendorCustomSport = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId;
  if (!vendorId) throw new ApiError(401, "Unauthorized");

  const { id } = req.params;

  const sport = await CustomSportModel.findOne({ _id: id, createdBy: vendorId, isActive: true });
  if (!sport) {
    throw new ApiError(404, "Custom sport not found");
  }

  sport.isActive = false;
  await sport.save();

  sendSuccess(res, 200, { success: true }, "Custom sport deleted successfully.");
});
