import { Request, Response } from "express";
import { AppVersionConfigModel } from "../../models/AppVersionConfig.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listAppVersions = asyncHandler(async (_req: Request, res: Response) => {
  const configs = await AppVersionConfigModel.find();
  sendSuccess(res, 200, configs);
});

export const upsertAppVersion = asyncHandler(async (req: Request, res: Response) => {
  const { platform, ...rest } = req.body;
  const config = await AppVersionConfigModel.findOneAndUpdate(
    { platform },
    { $set: rest },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  sendSuccess(res, 200, config, "App version config updated");
});
