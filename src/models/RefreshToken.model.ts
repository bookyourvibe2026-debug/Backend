import { Schema, model, Types } from "mongoose";
import type { Audience } from "../utils/jwt";

export interface RefreshTokenDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  audience: Audience;
  role: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByJti?: string | null;
  userAgent?: string;
  createdByIp?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  audience: { type: String, enum: ["customer", "vendor", "admin"], required: true },
  role: { type: String, required: true },
  jti: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByJti: { type: String, default: null },
  userAgent: { type: String },
  createdByIp: { type: String },
  createdAt: { type: Date, default: Date.now },
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<RefreshTokenDocument>("RefreshToken", refreshTokenSchema);
