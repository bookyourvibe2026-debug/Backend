import { Schema, model, Types } from "mongoose";

export type CoachBookingStatus = "Confirmed" | "Cancelled" | "Completed";
export type CoachBookingPaymentMethod = "Cashfree (Online)" | "Cash (Offline)" | "UPI";
export type CoachBookingPaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface CoachBookingDocument {
  _id: Types.ObjectId;
  orderId: string;
  coachId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  customerName: string;
  phone: string;
  email?: string;
  slotId: string;
  slotDate: Date;
  slotStartTime: string;
  slotEndTime: string;
  amount: number;
  payment: CoachBookingPaymentMethod;
  paymentStatus: CoachBookingPaymentStatus;
  paymentOrderId?: string;
  status: CoachBookingStatus;
  cancellationReason?: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const coachBookingSchema = new Schema<CoachBookingDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    coachId: { type: Schema.Types.ObjectId, ref: "Coach", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    slotId: { type: String, required: true },
    slotDate: { type: Date, required: true },
    slotStartTime: { type: String, required: true },
    slotEndTime: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    payment: { type: String, enum: ["Cashfree (Online)", "Cash (Offline)", "UPI"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentOrderId: { type: String },
    status: { type: String, enum: ["Confirmed", "Cancelled", "Completed"], default: "Confirmed" },
    cancellationReason: { type: String },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true }
);

coachBookingSchema.index({ vendorId: 1, slotDate: -1 });

export const CoachBookingModel = model<CoachBookingDocument>("CoachBooking", coachBookingSchema);
