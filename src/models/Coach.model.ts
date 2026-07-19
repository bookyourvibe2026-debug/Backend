import { Schema, model, Types } from "mongoose";

/**
 * One day of the coach's recurring weekly availability.
 * `day` follows JS getDay(): 0 = Sunday … 6 = Saturday.
 * When `isOpen` is false the coach is off that weekday (a recurring weekly holiday).
 */
export interface CoachWeeklyDay {
  day: number;
  isOpen: boolean;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

/** A one-off / emergency holiday on a specific calendar date. */
export interface CoachLeave {
  date: Date;
  type: "full" | "half";
  reason?: string;
}

/**
 * A recurring coaching batch. Customers subscribe to a batch (monthly / yearly /
 * demo) rather than a single dated slot. `capacity` caps how many active students
 * a batch can hold; spots-left is derived from active subscriptions.
 */
export interface CoachBatch {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  days: number[]; // weekdays this batch runs on (0–6)
  capacity: number;
  priceMonthly: number;
  priceYearly: number;
  demoAvailable: boolean;
  active: boolean;
}

export interface CoachLocation {
  address?: string;
  area?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface CoachDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  slug?: string;
  name: string;
  /** Primary sport — kept in sync with categories[0] for back-compat with legacy filters. */
  category: string;
  /** All sports this coach teaches (multi-select + custom "Others"). */
  categories: string[];
  subCategory?: string;
  phone?: string;
  email?: string;
  experienceYears?: number;
  /** "Starting from" price shown on cards; batch pricing is authoritative for booking. */
  fees?: number;
  bio?: string;
  photoUrl?: string;
  /** Photo/gallery image URLs shown on the coach's public profile. */
  gallery: string[];
  status: "Active" | "Inactive";
  location: CoachLocation;
  /** GeoJSON point kept in sync with location.lat/lng for $near queries. */
  geo?: { type: "Point"; coordinates: [number, number] };
  weeklyAvailability: CoachWeeklyDay[];
  leaves: CoachLeave[];
  batches: CoachBatch[];
  createdAt: Date;
  updatedAt: Date;
}

const weeklyDaySchema = new Schema<CoachWeeklyDay>(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    isOpen: { type: Boolean, default: false },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "18:00" },
  },
  { _id: false }
);

const leaveSchema = new Schema<CoachLeave>(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ["full", "half"], default: "full" },
    reason: { type: String, maxlength: 200 },
  },
  { _id: false }
);

const batchSchema = new Schema<CoachBatch>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    days: { type: [Number], default: [] },
    capacity: { type: Number, required: true, min: 1 },
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, required: true, min: 0 },
    demoAvailable: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const locationSchema = new Schema<CoachLocation>(
  {
    address: { type: String, maxlength: 300 },
    area: { type: String, maxlength: 120 },
    city: { type: String, maxlength: 120 },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const coachSchema = new Schema<CoachDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true },
    categories: { type: [String], default: [] },
    subCategory: { type: String },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    experienceYears: { type: Number, min: 0 },
    fees: { type: Number, min: 0 },
    bio: { type: String, maxlength: 1000 },
    photoUrl: { type: String },
    gallery: { type: [String], default: [] },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    location: { type: locationSchema, default: {} },
    geo: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] }, // [lng, lat]
    },
    weeklyAvailability: { type: [weeklyDaySchema], default: () => defaultWeek() },
    leaves: { type: [leaveSchema], default: [] },
    batches: { type: [batchSchema], default: [] },
  },
  { timestamps: true }
);

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Give every coach a readable, stable URL slug — "rohan-sharma-a1b2c3" — instead
// of exposing the raw Mongo _id in customer-facing links.
coachSchema.pre("save", function syncSlug(next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = slugify(this.name || "coach");
    const suffix = this._id.toString().slice(-6);
    this.slug = `${baseSlug}-${suffix}`;
  }
  next();
});

function defaultWeek(): CoachWeeklyDay[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    isOpen: day !== 0, // Sunday off by default
    startTime: "09:00",
    endTime: "18:00",
  }));
}

// Keep category (primary) and categories (multi) mutually consistent so both the
// legacy single-sport filter and the new multi-sport browse keep working.
coachSchema.pre("save", function syncCategories(next) {
  const list = (this.categories ?? []).map((c) => c.trim()).filter(Boolean);
  if (list.length > 0) {
    this.categories = Array.from(new Set(list));
    if (!this.category || !this.categories.includes(this.category)) this.category = this.categories[0]!;
  } else if (this.category) {
    this.categories = [this.category];
  }
  next();
});

// Keep the GeoJSON point in sync with the friendly lat/lng before every save.
coachSchema.pre("save", function syncGeo(next) {
  const { lat, lng } = this.location ?? {};
  if (typeof lat === "number" && typeof lng === "number") {
    this.geo = { type: "Point", coordinates: [lng, lat] };
  } else {
    this.geo = undefined;
  }
  next();
});

coachSchema.index({ vendorId: 1, status: 1 });
coachSchema.index({ category: 1, status: 1 });
coachSchema.index({ geo: "2dsphere" });

export const CoachModel = model<CoachDocument>("Coach", coachSchema);
