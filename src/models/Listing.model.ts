import { Schema, model, Types } from "mongoose";

export type ListingType = "Turf" | "Game" | "Event";
export type ListingAccess = "Vendor Owned" | "Claimed from Admin";
export type BookingType = "Recurring" | "Trips" | "Courses";

export interface ListingImage {
  id: string;
  url: string;
  label: string;
}

export interface ListingFAQ {
  question: string;
  answer: string;
}

export interface ItineraryStop {
  day: number;
  title: string;
  description: string;
}

export interface PriceTier {
  id: string;
  label: string;
  amount: number;
}

export interface AddOn {
  id: string;
  label: string;
  price: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
}

export interface TurfSlot {
  startTime: string;
  endTime: string;
  label: string;
  price: number;
  blocked?: boolean;
  blockedReason?: string;
}

export interface DateOverride {
  date: string;
  isHoliday: boolean;
  holidayName: string;
  slots: TurfSlot[];
}

export interface ListingDocument {
  _id: Types.ObjectId;
  title: string;
  type: ListingType;
  categories: string[];
  subCategories: string[];
  price: number;
  /** Ticket cap for type: "Event" listings — unused for Turf/Game. */
  capacity?: number;
  status: "Active" | "Inactive";
  trending: boolean;
  isPrivate: boolean;
  access: ListingAccess;
  vendorId?: Types.ObjectId | null;
  ownerName?: string;
  sharedWithVendors: boolean;
  coverImage?: string;
  images: ListingImage[];
  country?: string;
  city: string;
  state: string;
  cityMode: "single" | "multiple";
  cities: string[];
  address: string;
  startingPoint?: string;
  endingPoint?: string;
  reportingStartTime?: string;
  reportingEndTime?: string;
  description: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryStop[];
  faqs: ListingFAQ[];
  tags: string[];
  priceTiers: PriceTier[];
  addOns: AddOn[];
  coupons: Coupon[];
  bookingType: BookingType;
  availableFrom: Date;
  availableTill: Date;
  slotsPerDay: number;
  slotsList: TurfSlot[];
  dailyRoutine: boolean;
  dateOverrides: DateOverride[];
  createdAt: Date;
  updatedAt: Date;
}

const listingImageSchema = new Schema<ListingImage>({ id: String, url: String, label: String }, { _id: false });
const faqSchema = new Schema<ListingFAQ>({ question: String, answer: String }, { _id: false });
const itinerarySchema = new Schema<ItineraryStop>({ day: Number, title: String, description: String }, { _id: false });
const priceTierSchema = new Schema<PriceTier>({ id: String, label: String, amount: Number }, { _id: false });
const addOnSchema = new Schema<AddOn>({ id: String, label: String, price: Number }, { _id: false });
const couponSchema = new Schema<Coupon>({ id: String, code: String, discountPercent: Number }, { _id: false });

const turfSlotSchema = new Schema<TurfSlot>(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    label: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    blocked: { type: Boolean, default: false },
    blockedReason: { type: String },
  },
  { _id: false }
);

const dateOverrideSchema = new Schema<DateOverride>(
  {
    date: { type: String, required: true },
    isHoliday: { type: Boolean, default: false },
    holidayName: { type: String, default: "" },
    slots: { type: [turfSlotSchema], default: [] },
  },
  { _id: false }
);

const listingSchema = new Schema<ListingDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: ["Turf", "Game", "Event"], required: true },
    categories: { type: [String], default: [], index: true },
    subCategories: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    capacity: { type: Number, min: 1 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    trending: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    access: { type: String, enum: ["Vendor Owned", "Claimed from Admin"], default: "Vendor Owned" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", default: null, index: true },
    ownerName: { type: String },
    sharedWithVendors: { type: Boolean, default: false },
    coverImage: { type: String },
    images: { type: [listingImageSchema], default: [] },
    country: { type: String, default: "India" },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true },
    cityMode: { type: String, enum: ["single", "multiple"], default: "single" },
    cities: { type: [String], default: [] },
    address: { type: String, required: true },
    startingPoint: { type: String },
    endingPoint: { type: String },
    reportingStartTime: { type: String },
    reportingEndTime: { type: String },
    description: { type: String, required: true },
    highlights: { type: [String], default: [] },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    itinerary: { type: [itinerarySchema], default: [] },
    faqs: { type: [faqSchema], default: [] },
    tags: { type: [String], default: [], index: true },
    priceTiers: { type: [priceTierSchema], default: [] },
    addOns: { type: [addOnSchema], default: [] },
    coupons: { type: [couponSchema], default: [] },
    bookingType: { type: String, enum: ["Recurring", "Trips", "Courses"], default: "Recurring" },
    availableFrom: { type: Date, required: true },
    availableTill: { type: Date, required: true },
    slotsPerDay: { type: Number, required: true, min: 1 },
    slotsList: { type: [turfSlotSchema], default: [] },
    dailyRoutine: { type: Boolean, default: true },
    dateOverrides: { type: [dateOverrideSchema], default: [] },
  },
  { timestamps: true }
);

listingSchema.index({ title: "text", description: "text", tags: "text" });

/*
 * Compound indexes matching the real query shapes (filter fields first, then sort
 * fields). Without these, the public browse ran a collection scan plus an
 * in-memory sort, which degrades as the catalogue grows.
 */

// Public browse: { status, isPrivate, ...optional filters } sorted by { trending, createdAt }.
listingSchema.index({ status: 1, isPrivate: 1, trending: -1, createdAt: -1 });
// Public browse narrowed by city (the most common filter), same sort.
listingSchema.index({ status: 1, isPrivate: 1, city: 1, trending: -1, createdAt: -1 });
// Public browse narrowed by type, same sort.
listingSchema.index({ status: 1, isPrivate: 1, type: 1, trending: -1, createdAt: -1 });
// Public vendor profile: { vendorId, status, isPrivate, type } sorted by { trending, createdAt }.
listingSchema.index({ vendorId: 1, status: 1, isPrivate: 1, type: 1, trending: -1, createdAt: -1 });
// Vendor panel listing table: { vendorId } sorted by { createdAt }.
listingSchema.index({ vendorId: 1, createdAt: -1 });

export const ListingModel = model<ListingDocument>("Listing", listingSchema);
