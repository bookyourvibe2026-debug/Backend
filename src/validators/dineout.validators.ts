import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
/** Accepts either a real ObjectId or a URL slug — public restaurant links use slugs. */
const idOrSlug = z.string().regex(/^[a-f\d]{24}$|^[a-z0-9-]+$/i, "Invalid restaurant id or slug");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
/** "YYYY-MM-DD" — the reservation day, free of timezone ambiguity. */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const bookingStatus = z.enum([
  "Pending",
  "Confirmed",
  "Rejected",
  "Seated",
  "Completed",
  "Cancelled",
  "NoShow",
]);

/* ─── Table bookings ────────────────────────────────────────────── */

export const slotsParamSchema = z.object({ id: idOrSlug });

export const slotsQuerySchema = z.object({
  date: calendarDate,
});

export const createTableBookingSchema = z.object({
  outletId: idOrSlug,
  date: calendarDate,
  slotTime: timeOfDay,
  partySize: z.coerce.number().int().min(1).max(100),
  seatingPreference: z.string().trim().max(40).optional(),
  selectedOfferCode: z.string().trim().max(40).optional(),
  occasion: z.string().trim().max(60).optional(),
  specialRequests: z.string().trim().max(300).optional(),
});

export const bookingIdParamSchema = z.object({
  bookingId: z.string().min(1),
});

export const myBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const vendorBookingListQuerySchema = z.object({
  status: bookingStatus.optional(),
  outletId: objectId.optional(),
  scope: z.enum(["upcoming", "history"]).optional(),
  date: calendarDate.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["Confirmed", "Rejected", "Seated", "Completed", "Cancelled", "NoShow"]),
  rejectionReason: z.string().trim().max(200).optional(),
});

/* ─── Dining bills ──────────────────────────────────────────────── */

const billBody = {
  outletId: idOrSlug,
  billAmount: z.coerce.number().min(1, "Enter the bill amount").max(1_000_000),
  couponCode: z.string().trim().max(30).optional(),
  tipAmount: z.coerce.number().min(0).max(100_000).optional(),
  bankOfferCode: z.string().trim().max(30).optional(),
  walletAmount: z.coerce.number().min(0).max(1_000_000).optional(),
  rewardPointsRedeemed: z.coerce.number().min(0).max(1_000_000).optional(),
};

export const quoteDiningBillSchema = z.object(billBody);

export const payDiningBillSchema = z.object({
  ...billBody,
  paymentMethod: z.enum(["UPI", "Card", "NetBanking", "Wallet"]).optional(),
  /** Set when the player is settling a bill against a reservation they made. */
  bookingId: z.string().trim().max(60).optional(),
  /** How far the player was from the outlet, so wrong-outlet taps can be spotted later. */
  distanceMetres: z.coerce.number().min(0).max(5_000_000).optional(),
});

export const billIdParamSchema = z.object({
  billId: z.string().min(1),
});

export const vendorBillListQuerySchema = z.object({
  outletId: objectId.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
});

/* ─── Outlet Dineout settings ───────────────────────────────────── */

export const outletDineoutSchema = z.object({
  tableBooking: z.boolean().optional(),
  payBill: z.boolean().optional(),
  flatDiscountPct: z.coerce.number().min(0).max(100).optional(),
  slotMinutes: z.coerce.number().int().min(15).max(240).optional(),
  tablesPerSlot: z.coerce.number().int().min(1).max(500).optional(),
  maxPartySize: z.coerce.number().int().min(1).max(100).optional(),
  advanceDays: z.coerce.number().int().min(1).max(180).optional(),
  costForTwo: z.coerce.number().min(0).max(100000).optional(),
  autoConfirm: z.boolean().optional(),
});
