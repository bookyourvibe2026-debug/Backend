import { Schema, model, Types } from "mongoose";

export type Platform = "ios" | "android";

export interface AppVersionConfigDocument {
  _id: Types.ObjectId;
  platform: Platform;
  currentVersion: string;
  minRequiredVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  updatedAt: Date;
}

const appVersionConfigSchema = new Schema<AppVersionConfigDocument>(
  {
    platform: { type: String, enum: ["ios", "android"], required: true, unique: true },
    currentVersion: { type: String, required: true },
    minRequiredVersion: { type: String, required: true },
    downloadUrl: { type: String, required: true },
    releaseNotes: { type: String, default: "" },
    forceUpdate: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const AppVersionConfigModel = model<AppVersionConfigDocument>("AppVersionConfig", appVersionConfigSchema);
