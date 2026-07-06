import { Schema, model, Types } from "mongoose";

export const THEME_IDS = [
  "vibe-orange",
  "turf-emerald",
  "midnight-stadium",
  "sunset-court",
  "ocean-court",
  "royal-purple",
  "fire-red",
  "gold-luxury",
] as const;

export type SiteThemeId = (typeof THEME_IDS)[number];

/** Single global document — the whole site's live theme, keyed by a fixed `key` so findOneAndUpdate always targets the same row. */
export const SITE_APPEARANCE_KEY = "singleton" as const;
export const DEFAULT_SITE_THEME: SiteThemeId = "vibe-orange";

export interface SiteAppearanceDocument {
  _id: Types.ObjectId;
  key: typeof SITE_APPEARANCE_KEY;
  theme: SiteThemeId;
  updatedAt: Date;
}

const siteAppearanceSchema = new Schema<SiteAppearanceDocument>(
  {
    key: { type: String, required: true, unique: true, default: SITE_APPEARANCE_KEY },
    theme: { type: String, enum: THEME_IDS, required: true, default: DEFAULT_SITE_THEME },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const SiteAppearanceModel = model<SiteAppearanceDocument>("SiteAppearance", siteAppearanceSchema);
