import { Schema, model, Types } from "mongoose";

export interface ReviewDocument {
  _id: Types.ObjectId;
  listingId: Types.ObjectId;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDocument>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

reviewSchema.index({ listingId: 1, createdAt: -1 });

export const ReviewModel = model<ReviewDocument>("Review", reviewSchema);
