import { Schema, model, Types } from "mongoose";

export type CoachSubscriptionPlan = "demo" | "monthly" | "yearly";
export type CoachSubscriptionStatus = "Active" | "Cancelled" | "Expired";
export type CoachSubPaymentMethod = "Cashfree (Online)" | "Cash (Offline)" | "UPI";
export type CoachSubPaymentStatus = "pending" | "paid" | "failed" | "refunded";

/**
 * A student's enrolment into a coaching batch. Replaces the old per-session
 * CoachBooking: a subscription holds a seat in a batch for a plan period
 * (demo / monthly / yearly). Spots-left for a batch = capacity − active subs.
 */
export interface CoachSubscriptionDocument {
  _id: Types.ObjectId;
  orderId: string;
  coachId: Types.ObjectId;
  vendorId: Types.ObjectId;
  batchId: string;
  batchName: string;
  customerId?: Types.ObjectId | null;
  customerName: string;
  phone: string;
  email?: string;
  plan: CoachSubscriptionPlan;
  amount: number;
  startDate: Date;
  endDate?: Date | null; // null for demo (single session)
  payment: CoachSubPaymentMethod;
  paymentStatus: CoachSubPaymentStatus;
  paymentOrderId?: string;
  status: CoachSubscriptionStatus;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const coachSubscriptionSchema = new Schema<CoachSubscriptionDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    coachId: { type: Schema.Types.ObjectId, ref: "Coach", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    batchId: { type: String, required: true },
    batchName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    plan: { type: String, enum: ["demo", "monthly", "yearly"], required: true },
    amount: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    payment: { type: String, enum: ["Cashfree (Online)", "Cash (Offline)", "UPI"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentOrderId: { type: String },
    status: { type: String, enum: ["Active", "Cancelled", "Expired"], default: "Active" },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

// Fast spots-left counting: active subs per batch.
coachSubscriptionSchema.index({ coachId: 1, batchId: 1, status: 1 });
coachSubscriptionSchema.index({ vendorId: 1, createdAt: -1 });

export const CoachSubscriptionModel = model<CoachSubscriptionDocument>(
  "CoachSubscription",
  coachSubscriptionSchema
);
