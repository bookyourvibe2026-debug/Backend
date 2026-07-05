import { Schema, model, Types } from "mongoose";

export type SubscriptionStatus = "active" | "expired" | "cancelled";

export interface SubscriptionDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  membershipId: Types.ObjectId;
  customerName: string;
  phone: string;
  customerId?: Types.ObjectId | null;
  amountPaid: number;
  startDate: Date;
  endDate?: Date | null;
  sessionsRemaining?: number;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "Membership", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    amountPaid: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    sessionsRemaining: { type: Number, min: 0 },
    status: { type: String, enum: ["active", "expired", "cancelled"], default: "active" },
  },
  { timestamps: true }
);

export const SubscriptionModel = model<SubscriptionDocument>("Subscription", subscriptionSchema);
