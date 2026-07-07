import { Schema, model, Types } from "mongoose";

export interface CoachSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export interface CoachDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  name: string;
  category: string;
  subCategory?: string;
  experienceYears?: number;
  fees: number;
  bio?: string;
  photoUrl?: string;
  status: "Active" | "Inactive";
  slots: CoachSlot[];
  createdAt: Date;
  updatedAt: Date;
}

const coachSlotSchema = new Schema<CoachSlot>(
  {
    id: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isBooked: { type: Boolean, default: false },
  },
  { _id: false }
);

const coachSchema = new Schema<CoachDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true },
    subCategory: { type: String },
    experienceYears: { type: Number, min: 0 },
    fees: { type: Number, required: true, min: 0 },
    bio: { type: String, maxlength: 1000 },
    photoUrl: { type: String },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    slots: { type: [coachSlotSchema], default: [] },
  },
  { timestamps: true }
);

coachSchema.index({ vendorId: 1, status: 1 });
coachSchema.index({ category: 1, status: 1 });

export const CoachModel = model<CoachDocument>("Coach", coachSchema);
