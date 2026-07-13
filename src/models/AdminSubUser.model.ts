import { Schema, model, Types } from "mongoose";

export type AdminModuleKey =
  | "dashboard"
  | "vendors"
  | "listings"
  | "bookings"
  | "payouts"
  | "blog"
  | "banners"
  | "marketing"
  | "categories"
  | "users"
  | "subAdmins"
  | "systemHealth"
  | "appVersion";

export interface AdminRoleModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface AdminSubUserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  status: "Active" | "Inactive";
  permissions: Partial<Record<AdminModuleKey, AdminRoleModulePermissions>>;
  createdAt: Date;
  updatedAt: Date;
}

const permissionShape = {
  view: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
};

const adminSubUserSchema = new Schema<AdminSubUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    permissions: {
      dashboard: permissionShape,
      vendors: permissionShape,
      listings: permissionShape,
      bookings: permissionShape,
      payouts: permissionShape,
      blog: permissionShape,
      banners: permissionShape,
      marketing: permissionShape,
      categories: permissionShape,
      users: permissionShape,
      subAdmins: permissionShape,
      systemHealth: permissionShape,
      appVersion: permissionShape,
    },
  },
  { timestamps: true }
);

export const AdminSubUserModel = model<AdminSubUserDocument>("AdminSubUser", adminSubUserSchema);
