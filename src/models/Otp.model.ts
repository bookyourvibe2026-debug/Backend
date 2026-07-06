import { Schema, model } from "mongoose";

export type OtpPurpose = "customer_login" | "customer_reset" | "vendor_reset" | "vendor_register";

export interface OtpDocument {
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date | null;
  createdAt: Date;
}

const otpSchema = new Schema<OtpDocument>({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  purpose: { type: String, enum: ["customer_login", "customer_reset", "vendor_reset", "vendor_register"], required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = model<OtpDocument>("Otp", otpSchema);
