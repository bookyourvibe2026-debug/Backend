import { Schema, model, Types } from "mongoose";

export interface AdBannerDocument {
  _id: Types.ObjectId;
  imageUrl: string;
  title?: string;
  linkUrl?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const adBannerSchema = new Schema<AdBannerDocument>(
  {
    imageUrl: { type: String, required: true },
    title: { type: String, trim: true },
    linkUrl: { type: String, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AdBannerModel = model<AdBannerDocument>("AdBanner", adBannerSchema);
