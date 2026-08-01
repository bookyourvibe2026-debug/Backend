import { Schema, model, Document } from "mongoose";

export interface IGamingSession extends Document {
  vendorId: string;
  stationName: string; // e.g. "PS5 Controller 1", "Xbox Station A"
  gameTitle?: string;  // e.g. "FIFA 24", "Tekken 8", "GTA V"
  customerName?: string;
  customerPhone?: string;
  hourlyRate: number;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  totalAmount: number;
  paymentStatus: "pending" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const GamingSessionSchema = new Schema<IGamingSession>(
  {
    vendorId: { type: String, required: true, index: true },
    stationName: { type: String, required: true },
    gameTitle: { type: String },
    customerName: { type: String },
    customerPhone: { type: String },
    hourlyRate: { type: Number, required: true, default: 200 },
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["pending", "completed", "cancelled"], default: "pending", index: true },
  },
  { timestamps: true }
);

export const GamingSession = model<IGamingSession>("GamingSession", GamingSessionSchema);
