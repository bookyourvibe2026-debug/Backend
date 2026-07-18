import { Schema, model, Types } from "mongoose";

export type MembershipPlanType = "duration" | "sessions";

export interface MembershipDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  /** Turf/listing this plan belongs to; unset = applies to all of the vendor's turfs. */
  listingId?: Types.ObjectId;
  name: string;
  description?: string;
  planType: MembershipPlanType;
  price: number;
  durationDays?: number;
  sessionsIncluded?: number;
  turfDimensions?: string;
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<MembershipDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing" },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    planType: { type: String, enum: ["duration", "sessions"], required: true },
    price: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, min: 1 },
    sessionsIncluded: { type: Number, min: 1 },
    turfDimensions: { type: String, trim: true, maxlength: 60 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

export const MembershipModel = model<MembershipDocument>("Membership", membershipSchema);
