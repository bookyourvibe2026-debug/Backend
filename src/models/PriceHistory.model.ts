import { Schema, model, Document } from "mongoose";

export interface IPriceHistory extends Document {
  vendorId: string;
  listingId: string;
  date?: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason?: string;
  createdAt: Date;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    vendorId: { type: String, required: true, index: true },
    listingId: { type: String, required: true, index: true },
    date: { type: String, index: true },
    oldPrice: { type: Number, required: true },
    newPrice: { type: Number, required: true },
    changedBy: { type: String, required: true },
    reason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PriceHistorySchema.index({ listingId: 1, createdAt: -1 });

export const PriceHistory = model<IPriceHistory>("PriceHistory", PriceHistorySchema);
