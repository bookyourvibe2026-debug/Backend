import { Request, Response } from "express";
import { DEFAULT_SITE_THEME, SITE_APPEARANCE_KEY, SiteAppearanceModel } from "../../models/SiteAppearance.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getSiteAppearance = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await SiteAppearanceModel.findOne({ key: SITE_APPEARANCE_KEY });
  sendSuccess(res, 200, { theme: doc?.theme ?? DEFAULT_SITE_THEME });
});

export const updateSiteAppearance = asyncHandler(async (req: Request, res: Response) => {
  const { theme } = req.body;
  const doc = await SiteAppearanceModel.findOneAndUpdate(
    { key: SITE_APPEARANCE_KEY },
    { $set: { theme } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  sendSuccess(res, 200, { theme: doc.theme }, "Site theme updated — live for everyone now");
});
