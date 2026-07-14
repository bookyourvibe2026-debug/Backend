import { Schema, model, Types } from "mongoose";

export type VendorBusinessType = "Company" | "Individual / Proprietor" | "Partnership";
export type VendorBankAccountType = "Savings" | "Current";
/** Which side(s) of the platform this vendor operates — drives which tab-bar/permissions they get. Not to be confused with VendorBusinessType (legal entity type). */
export type VendorVertical = "turf" | "events" | "food" | "coaches";

export interface VendorDocument {
  _id: Types.ObjectId;
  ownerName: string;
  businessName: string;
  email: string;
  phone: string;
  passwordHash: string;
  state: string;
  city?: string;
  verticals: VendorVertical[];
  status: "pending" | "approved" | "suspended";
  approvedOn?: Date | null;
  notifications: {
    email: boolean;
    whatsapp: boolean;
    offline: boolean;
  };
  logo?: string;
  banner?: string;
  poster?: string;
  businessType?: VendorBusinessType;
  gstNumber?: string;
  categories: string[];
  sports: string[];
  address: {
    street?: string;
    pinCode?: string;
    country?: string;
  };
  bankDetails: {
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    accountType?: VendorBankAccountType;
  };
  mpinHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<VendorDocument>(
  {
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    businessName: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    mpinHash: { type: String, select: false },
    state: { type: String, required: true },
    city: { type: String },
    verticals: {
      type: [String],
      enum: ["turf", "events", "food", "coaches"],
      default: ["turf"],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: "Select at least one role",
      },
    },
    status: { type: String, enum: ["pending", "approved", "suspended"], default: "pending" },
    approvedOn: { type: Date, default: null },
    notifications: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      offline: { type: Boolean, default: false },
    },
    logo: { type: String },
    banner: { type: String },
    poster: { type: String },
    businessType: { type: String, enum: ["Company", "Individual / Proprietor", "Partnership"] },
    gstNumber: { type: String, trim: true },
    categories: { type: [String], default: [] },
    sports: { type: [String], default: [] },
    address: {
      street: { type: String },
      pinCode: { type: String },
      country: { type: String, default: "India" },
    },
    bankDetails: {
      type: {
        accountNumber: { type: String },
        ifsc: { type: String },
        bankName: { type: String },
        accountType: { type: String, enum: ["Savings", "Current"] },
      },
      default: {},
    },
  },
  { timestamps: true }
);

export const VendorModel = model<VendorDocument>("Vendor", vendorSchema);
