import { Schema, model, Types } from "mongoose";

export type VendorPayoutType = "Standard" | "Affiliate";
export type VendorPayoutStatus = "Pending" | "Processing" | "Paid" | "Failed" | "Cancelled";

export interface VendorPayoutDocument {
  _id: Types.ObjectId;
  categoryId?: Types.ObjectId | null;
  vendorId: Types.ObjectId;
  type: VendorPayoutType;
  status: VendorPayoutStatus;
  amount: number;
  bookingsCount: number;
  bookingIds: Types.ObjectId[];
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vendorPayoutSchema = new Schema<VendorPayoutDocument>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "PayoutCategory", default: null },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    type: { type: String, enum: ["Standard", "Affiliate"], default: "Standard" },
    status: { type: String, enum: ["Pending", "Processing", "Paid", "Failed", "Cancelled"], default: "Pending" },
    amount: { type: Number, required: true, min: 0 },
    bookingsCount: { type: Number, required: true, min: 0, default: 0 },
    bookingIds: { type: [Schema.Types.ObjectId], ref: "Booking", default: [] },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const VendorPayoutModel = model<VendorPayoutDocument>("VendorPayout", vendorPayoutSchema);
