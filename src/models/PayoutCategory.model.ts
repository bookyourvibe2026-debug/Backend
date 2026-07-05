import { Schema, model, Types } from "mongoose";

export interface PayoutCategoryDocument {
  _id: Types.ObjectId;
  name: string;
  letter: string;
  color: string;
  subtitle: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutCategorySchema = new Schema<PayoutCategoryDocument>(
  {
    name: { type: String, required: true },
    letter: { type: String, required: true, maxlength: 2 },
    color: { type: String, required: true },
    subtitle: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PayoutCategoryModel = model<PayoutCategoryDocument>("PayoutCategory", payoutCategorySchema);
