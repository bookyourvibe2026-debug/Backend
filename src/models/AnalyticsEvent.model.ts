import { Schema, model, Document } from "mongoose";

export interface IAnalyticsEvent extends Document {
  userId?: string;
  userType: "customer" | "vendor" | "admin" | "guest";
  eventType: string;
  properties?: Record<string, any>;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    userId: { type: String, index: true },
    userType: {
      type: String,
      enum: ["customer", "vendor", "admin", "guest"],
      default: "guest",
      index: true,
    },
    eventType: { type: String, required: true, index: true },
    properties: { type: Schema.Types.Mixed, default: {} },
    sessionId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    utmSource: { type: String, index: true },
    utmMedium: { type: String },
    utmCampaign: { type: String, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AnalyticsEventSchema.index({ eventType: 1, createdAt: -1 });

export const AnalyticsEvent = model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema);
