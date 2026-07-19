import { Schema, model, Types } from "mongoose";

/** One day of the outlet's recurring weekly opening hours. `day` follows JS getDay(). */
export interface OutletWeeklyDay {
  day: number;
  isOpen: boolean;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

/** A one-off holiday/closure on a specific calendar date. */
export interface OutletLeave {
  date: Date;
  type: "full" | "half";
  reason?: string;
}

export interface OutletLocation {
  address?: string;
  area?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface FoodOutletDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  slug?: string;
  name: string;
  /** "dining" = a standalone cafe/restaurant near a venue (customers go & get a discount);
   *  "venue" = food served at a turf/pickleball venue itself (shows what's available there). */
  kind: "dining" | "venue";
  /** Offer/discount blurb shown on dining cards, e.g. "10% off for BYV players". */
  offer?: string;
  description?: string;
  /** Cuisine tags shown on cards and used for browse filtering (presets + custom). */
  cuisines: string[];
  logo?: string;
  banner?: string;
  poster?: string;
  gallery: string[];
  location: OutletLocation;
  weeklyAvailability: OutletWeeklyDay[];
  leaves: OutletLeave[];
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;
}

const weeklyDaySchema = new Schema<OutletWeeklyDay>(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    isOpen: { type: Boolean, default: true },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "22:00" },
  },
  { _id: false }
);

const leaveSchema = new Schema<OutletLeave>(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ["full", "half"], default: "full" },
    reason: { type: String, maxlength: 200 },
  },
  { _id: false }
);

const locationSchema = new Schema<OutletLocation>(
  {
    address: { type: String, maxlength: 300 },
    area: { type: String, maxlength: 120 },
    city: { type: String, maxlength: 120 },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const foodOutletSchema = new Schema<FoodOutletDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: ["dining", "venue"], default: "dining" },
    offer: { type: String, maxlength: 120 },
    description: { type: String, maxlength: 1000 },
    cuisines: { type: [String], default: [] },
    logo: { type: String },
    banner: { type: String },
    poster: { type: String },
    gallery: { type: [String], default: [] },
    location: { type: locationSchema, default: {} },
    weeklyAvailability: { type: [weeklyDaySchema], default: () => defaultWeek() },
    leaves: { type: [leaveSchema], default: [] },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

function defaultWeek(): OutletWeeklyDay[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    isOpen: true,
    startTime: "09:00",
    endTime: "22:00",
  }));
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Readable, stable public URL slug — "spice-villa-a1b2c3" — instead of a raw id.
foodOutletSchema.pre("save", function syncSlug(next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = slugify(this.name || "outlet");
    const suffix = this._id.toString().slice(-6);
    this.slug = `${baseSlug}-${suffix}`;
  }
  next();
});

foodOutletSchema.index({ vendorId: 1, status: 1 });
foodOutletSchema.index({ status: 1, createdAt: -1 });

export const FoodOutletModel = model<FoodOutletDocument>("FoodOutlet", foodOutletSchema);
