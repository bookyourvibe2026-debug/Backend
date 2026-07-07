import { Schema, model, Types } from "mongoose";

export type TournamentRegistrationStatus = "Registered" | "Cancelled" | "Withdrawn";
export type TournamentRegistrationPaymentMethod = "Cashfree (Online)" | "Cash (Offline)" | "UPI";
export type TournamentRegistrationPaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface TournamentPlayer {
  name: string;
  phone?: string;
}

export interface TournamentRegistrationDocument {
  _id: Types.ObjectId;
  orderId: string;
  tournamentId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  teamName: string;
  captainName: string;
  captainPhone: string;
  captainEmail?: string;
  players: TournamentPlayer[];
  amount: number;
  payment: TournamentRegistrationPaymentMethod;
  paymentStatus: TournamentRegistrationPaymentStatus;
  paymentOrderId?: string;
  status: TournamentRegistrationStatus;
  cancellationReason?: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentPlayerSchema = new Schema<TournamentPlayer>(
  { name: { type: String, required: true, trim: true }, phone: { type: String, trim: true } },
  { _id: false }
);

const tournamentRegistrationSchema = new Schema<TournamentRegistrationDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    teamName: { type: String, required: true, trim: true, maxlength: 120 },
    captainName: { type: String, required: true },
    captainPhone: { type: String, required: true },
    captainEmail: { type: String },
    players: { type: [tournamentPlayerSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    payment: { type: String, enum: ["Cashfree (Online)", "Cash (Offline)", "UPI"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentOrderId: { type: String },
    status: { type: String, enum: ["Registered", "Cancelled", "Withdrawn"], default: "Registered" },
    cancellationReason: { type: String },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tournamentRegistrationSchema.index({ vendorId: 1, createdAt: -1 });

export const TournamentRegistrationModel = model<TournamentRegistrationDocument>(
  "TournamentRegistration",
  tournamentRegistrationSchema
);
