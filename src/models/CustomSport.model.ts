import { Schema, model, Types } from "mongoose";

export interface CustomSportDocument {
  _id: Types.ObjectId;
  sportName: string;
  iconUrl: string;
  createdBy: Types.ObjectId;
  venue: "both" | "indoor" | "outdoor";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customSportSchema = new Schema<CustomSportDocument>(
  {
    sportName: { type: String, required: true, trim: true },
    iconUrl: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    venue: { type: String, enum: ["both", "indoor", "outdoor"], default: "both" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customSportSchema.index({ createdBy: 1, sportName: 1 });

export const CustomSportModel = model<CustomSportDocument>("CustomSport", customSportSchema);
