import { Request, Response } from "express";
import { DEFAULT_SITE_THEME, SITE_APPEARANCE_KEY, SiteAppearanceModel } from "../../models/SiteAppearance.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getSiteAppearance = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await SiteAppearanceModel.findOne({ key: SITE_APPEARANCE_KEY });
  sendSuccess(res, 200, {
    theme: doc?.theme ?? DEFAULT_SITE_THEME,
    customBrand: doc?.customBrand,
    customAccent: doc?.customAccent,
  });
});

export const updateSiteAppearance = asyncHandler(async (req: Request, res: Response) => {
  const { theme, customBrand, customAccent } = req.body;

  if (theme === "custom" && (!customBrand || !customAccent)) {
    throw ApiError.badRequest("customBrand and customAccent are required when theme is \"custom\"");
  }

  const doc = await SiteAppearanceModel.findOneAndUpdate(
    { key: SITE_APPEARANCE_KEY },
    theme === "custom"
      ? { $set: { theme, customBrand, customAccent } }
      : { $set: { theme }, $unset: { customBrand: "", customAccent: "" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  sendSuccess(
    res,
    200,
    { theme: doc.theme, customBrand: doc.customBrand, customAccent: doc.customAccent },
    "Site theme updated — live for everyone now"
  );
});
