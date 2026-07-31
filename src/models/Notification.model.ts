import { Schema, model, Document, Types } from "mongoose";

export type NotificationType =
  | "join_request"
  | "request_accepted"
  | "request_rejected"
  | "payment_confirmed"
  | "request_expired";

export interface NotificationDocument extends Document {
  recipientCustomerId?: Types.ObjectId | null;
  recipientPhone?: string;
  title: string;
  message: string;
  type: NotificationType;
  matchId?: string;
  participantId?: string;
  playerName?: string;
  playerAvatar?: string;
  sport?: string;
  turfName?: string;
  date?: string;
  timeSlot?: string;
  entryFee?: number;
  expiresAt?: Date;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    recipientCustomerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    recipientPhone: { type: String, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["join_request", "request_accepted", "request_rejected", "payment_confirmed", "request_expired"],
      required: true,
    },
    matchId: { type: String, index: true },
    participantId: { type: String },
    playerName: { type: String },
    playerAvatar: { type: String },
    sport: { type: String },
    turfName: { type: String },
    date: { type: String },
    timeSlot: { type: String },
    entryFee: { type: Number },
    expiresAt: { type: Date },
    actionUrl: { type: String },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientCustomerId: 1, createdAt: -1 });
notificationSchema.index({ recipientPhone: 1, createdAt: -1 });

export const NotificationModel = model<NotificationDocument>("CustomerNotification", notificationSchema);
