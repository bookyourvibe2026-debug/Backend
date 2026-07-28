import { Schema, model, Document, Types } from "mongoose";

export type HostedMatchStatus =
  | "Draft"
  | "Awaiting Host Payment"
  | "Open for Joining"
  | "Full"
  | "Completed"
  | "Cancelled";

export type ParticipantStatus =
  | "Pending Approval"
  | "Payment Pending"
  | "Confirmed"
  | "Rejected"
  | "Cancelled";

export interface HostedMatchParticipant {
  participantId: string;
  customerId?: Types.ObjectId | null;
  name: string;
  phone?: string;
  email?: string;
  joinedAt: Date;
  status: ParticipantStatus;
  paymentStatus: "pending" | "paid" | "failed";
  paymentOrderId?: string;
  amountPaid: number;
}

export interface HostedMatchDocument extends Document {
  matchId: string;
  listingId: Types.ObjectId;
  vendorId: Types.ObjectId;
  hostCustomerId: Types.ObjectId;
  hostName: string;
  hostPhone: string;
  hostEmail?: string;
  sport: string;
  date: string;
  dateTime: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  courtId?: string;
  courtName?: string;
  pricingType: "host_pays_all" | "split_cost";
  totalTurfCost: number;
  hostPaidAmount: number;
  entryFeePerPlayer: number;
  maxPlayers: number;
  bookingId?: Types.ObjectId | null;
  hostPaymentOrderId?: string;
  hostPaymentStatus: "pending" | "paid" | "failed";
  status: HostedMatchStatus;
  participants: HostedMatchParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<HostedMatchParticipant>(
  {
    participantId: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    joinedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["Pending Approval", "Payment Pending", "Confirmed", "Rejected", "Cancelled"],
      default: "Pending Approval",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentOrderId: { type: String },
    amountPaid: { type: Number, default: 0 },
  },
  { _id: false }
);

const hostedMatchSchema = new Schema<HostedMatchDocument>(
  {
    matchId: { type: String, required: true, unique: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    hostCustomerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    hostName: { type: String, required: true },
    hostPhone: { type: String, required: true },
    hostEmail: { type: String },
    sport: { type: String, required: true },
    date: { type: String, required: true, index: true },
    dateTime: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, default: 60 },
    courtId: { type: String },
    courtName: { type: String },
    pricingType: {
      type: String,
      enum: ["host_pays_all", "split_cost"],
      required: true,
    },
    totalTurfCost: { type: Number, required: true, min: 0 },
    hostPaidAmount: { type: Number, required: true, min: 0 },
    entryFeePerPlayer: { type: Number, required: true, min: 0 },
    maxPlayers: { type: Number, required: true, min: 2, max: 50 },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    hostPaymentOrderId: { type: String },
    hostPaymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["Draft", "Awaiting Host Payment", "Open for Joining", "Full", "Completed", "Cancelled"],
      default: "Awaiting Host Payment",
      index: true,
    },
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
);

export const HostedMatchModel = model<HostedMatchDocument>("HostedMatch", hostedMatchSchema);
