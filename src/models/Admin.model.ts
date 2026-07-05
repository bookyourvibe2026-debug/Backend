import { Schema, model, Types } from "mongoose";

export interface AdminDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "super_admin";
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["super_admin"], default: "super_admin" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

export const AdminModel = model<AdminDocument>("Admin", adminSchema);
