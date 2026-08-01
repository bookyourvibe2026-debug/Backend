import { Schema, model, Document } from "mongoose";

export interface IReferral extends Document {
  referrerId: string; // ID of referring Customer or Vendor
  referrerType: "customer" | "vendor";
  code: string;
  referredPhone?: string;
  referredUserId?: string;
  status: "pending" | "completed" | "expired";
  rewardAmount: number;
  redeemedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerId: { type: String, required: true, index: true },
    referrerType: { type: String, enum: ["customer", "vendor"], required: true },
    code: { type: String, required: true, unique: true, index: true },
    referredPhone: { type: String },
    referredUserId: { type: String, index: true },
    status: { type: String, enum: ["pending", "completed", "expired"], default: "pending", index: true },
    rewardAmount: { type: Number, default: 100 },
    redeemedAt: { type: Date },
  },
  { timestamps: true }
);

export const Referral = model<IReferral>("Referral", ReferralSchema);
