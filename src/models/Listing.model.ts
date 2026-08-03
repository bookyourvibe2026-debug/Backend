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
  image?: ListingImage;
  /** Sports/games this add-on belongs to. Empty/undefined = available for all games. */
  sports?: string[];
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
}

export interface TurfSlot {
  id?: string;
  startTime: string;
  endTime: string;
  label: string;
  price: number;
  blocked?: boolean;
  blockedReason?: string;
  isClubSlot?: boolean;
  clubId?: string;
  slotIds?: string[];
  durationMinutes?: number;
}

export interface DateOverride {
  date: string;
  isHoliday: boolean;
  holidayName: string;
  slots: TurfSlot[];
}

export interface TechnicalSpec {
  label: string;
  value: string;
  icon: string;
  color?: string;
}

/** Per-sport player cap on a Turf/Game listing — e.g. Football allows 14, Badminton allows 4. */
export interface SportCapacity {
  category: string;
  maxPlayers: number;
}

/**
 * One physically bookable unit inside a venue — "Court 1", "Turf A", "Synthetic Court".
 * A listing with N courts can sell the same time slot N times over; without courts the
 * whole venue is a single unit and one booking blocks the entire time range.
 */
export interface Court {
  id: string;
  name: string;
  /** Sports this court can host. Empty means every sport the listing offers. */
  sports: string[];
  /** Replaces the time slot's hourly rate on this court. Undefined = inherit the slot price. */
  priceOverride?: number;
  /** Per-sport rate on this court, for venues charging differently per game on the same court. */
  sportPrices?: CourtSportPrice[];
  /** Photo shown on the court card at checkout. Picked from the listing's own images. */
  image?: string;
  /** Free-text surface/size line under the court name — "Outdoor · Synthetic · Full court". */
  surface?: string;
  /** Inactive courts stay on the listing (so past bookings still resolve) but cannot be booked. */
  active: boolean;
}

/** One sport's hourly rate on a court that hosts several sports at different prices. */
export interface CourtSportPrice {
  sport: string;
  price: number;
}

/**
 * Last Min Boost — a standing rule that discounts one Sport + Court + Slot combination
 * only inside a short window before the slot starts, to fill it at the last minute.
 *
 * The rule is keyed by slot start time rather than by date, so it applies every day:
 * a slot only carries the discount while it is still unbooked AND the clock is inside
 * `triggerMins` of its start. Nothing is written into slot prices — the discount is
 * derived on read, which is what makes the trigger window mean anything.
 *
 * A listing can carry several of these at once (e.g. Cricket on Court 3 boosted
 * differently from Football on Court 5) — each is independent and shows as its own
 * deal card. Omitting `courtId` means the rule applies to every active court that
 * hosts `game`.
 */
export interface LastMinuteBoostRule {
  id: string;
  enabled: boolean;
  /** Sport label the boost applies to, matching what a booking sends as `sport`. */
  game: string;
  /** Specific court this rule targets. Absent = every active court hosting `game`. */
  courtId?: string;
  /** Slot start times in "HH:mm" that the vendor opted into. */
  slotStarts: string[];
  /** 10-30. Enforced by the validator and clamped again on read. */
  discountPct: number;
  /** How many minutes before the slot the deal goes live. */
  triggerMins: number;
}

export interface PartialPaymentConfig {
  enabled: boolean;
  type: "percentage" | "fixed";
  value: number;
}

export interface ListingDocument {
  _id: Types.ObjectId;
  slug?: string;
  title: string;
  type: ListingType;
  categories: string[];
  subCategories: string[];
  /** Max players allowed per selected sport (Turf/Game listings) — one entry per category. */
  sportCapacities: SportCapacity[];
  /** Bookable units within this venue. Empty = the venue itself is the only unit. */
  courts: Court[];
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
  videoUrl?: string;
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
  technicalSpecs?: TechnicalSpec[];
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
  /** Empty on listings the vendor has never configured a boost for. */
  lastMinBoosts: LastMinuteBoostRule[];
  /** Mandatory partial payment configuration set by venue owner. */
  partialPayment?: PartialPaymentConfig;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const listingImageSchema = new Schema<ListingImage>({ id: String, url: String, label: String }, { _id: false });
const faqSchema = new Schema<ListingFAQ>({ question: String, answer: String }, { _id: false });
const itinerarySchema = new Schema<ItineraryStop>({ day: Number, title: String, description: String }, { _id: false });
const priceTierSchema = new Schema<PriceTier>({ id: String, label: String, amount: Number }, { _id: false });
const addOnSchema = new Schema<AddOn>({ id: String, label: String, price: Number, image: { type: listingImageSchema, required: false }, sports: { type: [String], default: [] } }, { _id: false });
const couponSchema = new Schema<Coupon>({ id: String, code: String, discountPercent: Number }, { _id: false });
const sportCapacitySchema = new Schema<SportCapacity>(
  { category: { type: String, required: true }, maxPlayers: { type: Number, required: true, min: 1 } },
  { _id: false }
);

const courtSportPriceSchema = new Schema<CourtSportPrice>(
  { sport: { type: String, required: true }, price: { type: Number, required: true, min: 0 } },
  { _id: false }
);

const courtSchema = new Schema<Court>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    sports: { type: [String], default: [] },
    priceOverride: { type: Number, min: 0 },
    sportPrices: { type: [courtSportPriceSchema], default: [] },
    image: { type: String },
    surface: { type: String, maxlength: 120 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const turfSlotSchema = new Schema<TurfSlot>(
  {
    id: { type: String },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    label: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    blocked: { type: Boolean, default: false },
    blockedReason: { type: String },
    isClubSlot: { type: Boolean, default: false },
    clubId: { type: String },
    slotIds: { type: [String], default: [] },
    durationMinutes: { type: Number },
  },
  { _id: false }
);

const lastMinuteBoostRuleSchema = new Schema<LastMinuteBoostRule>(
  {
    id: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    game: { type: String, default: "" },
    courtId: { type: String },
    slotStarts: { type: [String], default: [] },
    discountPct: { type: Number, min: 10, max: 30, default: 10 },
    triggerMins: { type: Number, min: 1, max: 240, default: 10 },
  },
  { _id: false }
);

const partialPaymentSchema = new Schema<PartialPaymentConfig>(
  {
    enabled: { type: Boolean, default: true },
    type: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    value: { type: Number, min: 0, default: 25 },
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
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    type: { type: String, enum: ["Turf", "Game", "Event"], required: true },
    categories: { type: [String], default: [], index: true },
    subCategories: { type: [String], default: [] },
    sportCapacities: { type: [sportCapacitySchema], default: [] },
    courts: { type: [courtSchema], default: [] },
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
    videoUrl: { type: String, default: "" },
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
    lastMinBoosts: { type: [lastMinuteBoostRuleSchema], default: [] },
    partialPayment: { type: partialPaymentSchema, default: () => ({ enabled: true, type: "percentage", value: 25 }) },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    technicalSpecs: {
      type: [
        new Schema<TechnicalSpec>(
          {
            label: { type: String, required: true },
            value: { type: String, required: true },
            icon: { type: String, required: true },
            color: { type: String, default: "purple" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
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

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")           // Replace spaces with -
    .replace(/[^\w-]+/g, "")       // Remove all non-word chars
    .replace(/--+/g, "-")         // Replace multiple - with single -
    .replace(/^-+/, "")             // Trim - from start of text
    .replace(/-+$/, "");            // Trim - from end of text
}

listingSchema.pre("save", function (next) {
  if (this.isModified("title") || !this.slug) {
    const baseSlug = slugify(this.title || "listing");
    const suffix = this._id.toString().substring(18);
    this.slug = `${baseSlug}-${suffix}`;
  }
  next();
});

export const ListingModel = model<ListingDocument>("Listing", listingSchema);
