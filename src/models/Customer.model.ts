import { Schema, model, Types } from "mongoose";

export interface CustomerDocument {
  _id: Types.ObjectId;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  city?: string;
  area?: string;
  sports?: string[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: "active" | "blocked";
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<CustomerDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    username: { type: String, trim: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    city: { type: String, trim: true },
    area: { type: String, trim: true },
    sports: { type: [String], default: [] },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
  },
  { timestamps: true }
);

export const CustomerModel = model<CustomerDocument>("Customer", customerSchema);
