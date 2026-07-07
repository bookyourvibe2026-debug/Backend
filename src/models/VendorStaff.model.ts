import { Schema, model, Types } from "mongoose";

export type ModulePermissionKey =
  | "dashboard"
  | "bookings"
  | "listings"
  | "earnings"
  | "verification"
  | "settings"
  | "membership"
  | "menu"
  | "foodOrders"
  | "coaches"
  | "tournaments";

export interface RoleModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type VendorStaffRoleType = "staff" | "subadmin";

export interface VendorStaffDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  roleName: string;
  holderName: string;
  holderEmail: string;
  holderPhone: string;
  passwordHash: string;
  accountType: VendorStaffRoleType;
  status: "Active" | "Inactive";
  permissions: Record<ModulePermissionKey, RoleModulePermissions>;
  createdAt: Date;
  updatedAt: Date;
}

const permissionShape = {
  view: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
};

const vendorStaffSchema = new Schema<VendorStaffDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    roleName: { type: String, required: true, trim: true },
    holderName: { type: String, required: true, trim: true },
    holderEmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
    holderPhone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    accountType: { type: String, enum: ["staff", "subadmin"], required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    permissions: {
      dashboard: permissionShape,
      bookings: permissionShape,
      listings: permissionShape,
      earnings: permissionShape,
      verification: permissionShape,
      settings: permissionShape,
      membership: permissionShape,
      menu: permissionShape,
      foodOrders: permissionShape,
      coaches: permissionShape,
      tournaments: permissionShape,
    },
  },
  { timestamps: true }
);

export const VendorStaffModel = model<VendorStaffDocument>("VendorStaff", vendorStaffSchema);
