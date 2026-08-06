import { FilterQuery } from "mongoose";
import { env } from "../config/env";
import { BookingDocument, BookingModel } from "../models/Booking.model";
import { Court, ListingModel, TurfSlot } from "../models/Listing.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";
import { boostedPrice, clampBoostPct, findActiveBoostRule } from "./lastMinBoost.service";
import { paymentProvider } from "./payment/payment.service";
import { invalidatePublicListingCache } from "./listing.service";

interface PricingResult {
  totalAmount: number;
  platformFee: number;
  taxes: number;
  vendorEarning: number;
}

export function computePricing(baseAmount: number, discountPercent = 0): PricingResult {
  const discounted = baseAmount - (baseAmount * discountPercent) / 100;
  const platformFee = Math.round((discounted * env.PLATFORM_COMMISSION_PERCENT) / 100);
  const taxes = 0;
  const vendorEarning = Math.max(discounted - platformFee - taxes, 0);
  return { totalAmount: Math.round(discounted), platformFee, taxes, vendorEarning: Math.round(vendorEarning) };
}

export interface CreateBookingInput {
  listingId: string;
  priceTierId?: string;
  addOnIds?: string[];
  couponCode?: string;
  dateTime: Date;
  customerName: string;
  phone: string;
  email?: string;
  payment: "Cashfree (Online)" | "Cash (Offline)" | "UPI";
  paymentType?: "partial" | "full";
  playProtect?: boolean;
  /** Court the customer picked. Omitted = auto-assign the first free court. */
  courtId?: string;
  /** Several courts taken in one booking. Takes precedence over `courtId` when non-empty. */
  courtIds?: string[];
  customerId?: string;
  sport?: string;
  durationMinutes?: number;
}

/* ── Slot availability ──
 * Bookings store their slot start as a UTC instant plus an optional "HH:mm" end;
 * everything below works in IST because that's the timezone slots are sold in. */
export const IST = "Asia/Kolkata";

export function istTimeHHmm(d: Date): string {
  return d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false });
}

export function timeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

export interface BookedRange {
  startTime: string;
  endTime: string;
  status: "Confirmed" | "Pending" | "Completed";
  /** Which court is taken. Absent only on bookings that predate the courts migration. */
  courtId?: string;
}

function toBookedRanges(bookings: { dateTime: Date; endTime?: string; status: string; courtId?: string; courtIds?: string[] }[]): BookedRange[] {
  // A booking spanning several courts takes each of them out separately, so it is
  // flattened into one range per court — callers then need no multi-court awareness.
  return bookings.flatMap((b) => {
    const base = {
      startTime: istTimeHHmm(b.dateTime),
      // Legacy bookings without a stored end are assumed to run one hour.
      endTime: b.endTime || istTimeHHmm(new Date(b.dateTime.getTime() + 60 * 60_000)),
      status: b.status as BookedRange["status"],
    };
    const courtIds = b.courtIds?.length ? b.courtIds : b.courtId ? [b.courtId] : [];
    if (courtIds.length === 0) return [base];
    return courtIds.map((courtId) => ({ ...base, courtId }));
  });
}

/** Non-cancelled bookings for one listing on one IST calendar date, as HH:mm ranges. */
export async function getBookedRangesForDate(listingId: string, date: string): Promise<BookedRange[]> {
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const bookings = await BookingModel.find({
    listingId,
    status: { $in: ["Confirmed", "Part Paid", "Completed"] },
    dateTime: { $gte: dayStart, $lt: dayEnd },
  })
    .select("dateTime endTime status courtId courtIds")
    .lean();

  return toBookedRanges(bookings);
}

/** Same as getBookedRangesForDate, but for many listings on one date in a single query —
 * used by callers that would otherwise run one query per listing in a loop (e.g. the
 * last-minute deals feed, which is polled every ~8-10s per client). */
export async function getBookedRangesForDates(listingIds: string[], date: string): Promise<Map<string, BookedRange[]>> {
  const result = new Map<string, BookedRange[]>();
  if (listingIds.length === 0) return result;

  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const bookings = await BookingModel.find({
    listingId: { $in: listingIds },
    status: { $in: ["Confirmed", "Part Paid", "Completed"] },
    dateTime: { $gte: dayStart, $lt: dayEnd },
  })
    .select("listingId dateTime endTime status courtId courtIds")
    .lean();

  const byListing = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = String(b.listingId);
    const bucket = byListing.get(key) ?? [];
    bucket.push(b);
    byListing.set(key, bucket);
  }
  for (const [listingId, bucket] of byListing) {
    result.set(listingId, toBookedRanges(bucket));
  }
  return result;
}

/** Courts a listing can sell right now, optionally narrowed to the courts hosting one sport. */
export function bookableCourts(courts: Court[] | undefined, sport?: string): Court[] {
  return (courts ?? []).filter(
    (c) => c.active && (!sport || c.sports.length === 0 || c.sports.includes(sport))
  );
}

/**
 * Picks the courts a booking lands on. Explicit choices are validated and must all be free;
 * with no choice we auto-assign the first free court, so the venue keeps selling while
 * any court is open and clients that predate court selection still work.
 *
 * Several courts can be taken at once — a team booking 2 of a venue's 3 pickleball courts
 * for the same hour is one booking that occupies both.
 */
function chooseCourts(
  courts: Court[],
  overlapping: BookedRange[],
  requestedIds: string[],
  sport: string | undefined
): Court[] {
  // A booking with no courtId predates the migration, when the venue was one unit —
  // treat it as occupying the first court so it still blocks something.
  const defaultCourtId = courts[0]!.id;
  const takenIds = new Set(overlapping.map((r) => r.courtId || defaultCourtId));

  if (requestedIds.length > 0) {
    const chosen: Court[] = [];
    for (const requestedId of Array.from(new Set(requestedIds))) {
      const court = courts.find((c) => c.id === requestedId);
      if (!court) throw ApiError.badRequest("The selected court is not part of this venue");
      if (!court.active) throw ApiError.badRequest(`${court.name} is currently unavailable`);
      if (sport && court.sports.length > 0 && !court.sports.includes(sport)) {
        throw ApiError.badRequest(`${court.name} does not host ${sport}`);
      }
      if (takenIds.has(court.id)) {
        throw ApiError.conflict(`${court.name} is already booked for this time. Please pick another court or slot.`);
      }
      chosen.push(court);
    }
    return chosen;
  }

  const candidates = bookableCourts(courts, sport);
  if (candidates.length === 0) {
    throw ApiError.badRequest(
      sport ? `No court at this venue hosts ${sport}` : "This venue has no bookable courts"
    );
  }
  const free = candidates.find((c) => !takenIds.has(c.id));
  if (!free) throw ApiError.conflict("All courts are booked for this time. Please pick a different slot.");
  return [free];
}

/**
 * The price for one time slot, resolved for a specific court and sport. A vendor can
 * price a slot four ways in Package Studio's Slot-by-Slot Pricing — an exact
 * sport+court override, a sport-only default (any court), a court-only default (any
 * sport), or the venue's global default — and this picks the most specific one that
 * exists, falling back down that same order. This is the single source of truth for
 * "what does this slot actually cost for this booking": both createBooking below and
 * booking-flow.tsx's own generatedSlots preview use this identical priority, so what a
 * customer is quoted at checkout is exactly what they're charged.
 */
export function getSlotPriceForCourtAndSport(
  slots: TurfSlot[],
  startTime: string,
  endTime: string,
  courtId: string | undefined,
  sport: string | undefined,
  baseHourlyRate: number
): number {
  const candidates = slots.filter((s) => s.startTime === startTime && s.endTime === endTime);
  if (candidates.length === 0) return baseHourlyRate;

  const matchSport = sport?.toLowerCase();
  let best = null;
  if (matchSport && courtId) {
    best = candidates.find(c => c.sport?.toLowerCase() === matchSport && c.courtId === courtId);
  }
  if (!best && matchSport) {
    best = candidates.find(c => c.sport?.toLowerCase() === matchSport && !c.courtId);
  }
  if (!best && courtId) {
    best = candidates.find(c => c.courtId === courtId && !c.sport);
  }
  if (!best) {
    best = candidates.find(c => !c.sport && !c.courtId);
  }
  if (!best) {
    best = candidates[0];
  }
  return best?.price ?? baseHourlyRate;
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  // Ranges crossing midnight (end <= start) extend into the next day.
  const aE = aEnd <= aStart ? aEnd + 1440 : aEnd;
  const bE = bEnd <= bStart ? bEnd + 1440 : bEnd;
  return aStart < bE && bStart < aE;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDocument> {
  const listing = await ListingModel.findOne({ _id: input.listingId, status: "Active", isPrivate: false });
  if (!listing) throw ApiError.notFound("Listing not found or unavailable");

  let baseAmount = listing.price;
  let selectedCourts: Court[] = [];
  let appliedBoost: { ruleId: string; discountPct: number; originalAmount: number; discountAmount: number } | undefined;
  const selectedPriceTier = input.priceTierId ? listing.priceTiers.find((t) => t.id === input.priceTierId) : undefined;
  if (input.priceTierId && !selectedPriceTier) {
    throw ApiError.badRequest("Selected price tier is not valid for this listing");
  }

  if (listing.type === "Turf") {
    const bDate = new Date(input.dateTime);
    // IST calendar date — toISOString() would shift slots before 5:30 AM to the previous day.
    const dateStr = bDate.toLocaleDateString("en-CA", { timeZone: IST });

    const override = listing.dateOverrides?.find((o) => o.date === dateStr);
    let slots = listing.slotsList || [];
    if (override) {
      if (override.isHoliday) throw ApiError.badRequest(`The venue is closed on the selected date: ${override.holidayName || "Holiday"}`);
      slots = override.slots || [];
    }

    const startTime = istTimeHHmm(bDate);
    const startMin = timeToMinutes(startTime);
    const durationMin = input.durationMinutes || 60;
    const endMin = startMin + durationMin;

    // Court selection runs before pricing because a court may override the slot rate.
    // Overlap is resolved per court, so a venue with three courts sells the same hour
    // three times instead of one booking blocking the whole place.
    const bookedRanges = await getBookedRangesForDate(input.listingId, dateStr);
    const overlapping = bookedRanges.filter((r) =>
      rangesOverlap(startMin, endMin, timeToMinutes(r.startTime), timeToMinutes(r.endTime))
    );

    const courts = listing.courts ?? [];
    if (courts.length === 0) {
      // Court-less listing: the venue itself is the single bookable unit.
      const clash = overlapping[0];
      if (clash) {
        throw ApiError.conflict(
          `This time overlaps an existing booking (${clash.startTime} - ${clash.endTime}). Please pick a different slot.`
        );
      }
    } else {
      const requestedIds = input.courtIds?.length ? input.courtIds : input.courtId ? [input.courtId] : [];
      selectedCourts = chooseCourts(courts, overlapping, requestedIds, input.sport);
    }

    // Price is whatever slot(s) this booking actually overlaps, pro-rated by minutes
    // covered in each — never a flat whole-day average. A venue with a cheaper morning
    // rate and a pricier evening rate (or a sport/court-specific override set in Package
    // Studio's Slot-by-Slot Pricing) must charge the rate for the time, sport and court
    // actually booked, and this must match what the customer was shown at checkout
    // (booking-flow.tsx's own generatedSlots preview uses this identical resolution).
    const venueDefaultRate = listing.price || 1000;
    const timeRanges: { startTime: string; endTime: string }[] = [];
    if (slots.length > 0) {
      const seen = new Set<string>();
      for (const s of slots) {
        const key = `${s.startTime}-${s.endTime}`;
        if (!seen.has(key)) {
          seen.add(key);
          timeRanges.push({ startTime: s.startTime, endTime: s.endTime });
        }
      }
    }

    /** Overlap-weighted hourly rate across [startMin, endMin) for one court (or the
     * court-less venue as a whole, when courtId is undefined). */
    const hourlyRateFor = (courtId: string | undefined): number => {
      let coveredMin = 0;
      let weightedSum = 0;
      for (const range of timeRanges) {
        const sStart = timeToMinutes(range.startTime);
        let sEnd = timeToMinutes(range.endTime);
        if (sEnd <= sStart) sEnd += 1440;
        const overlap = Math.min(endMin, sEnd) - Math.max(startMin, sStart);
        if (overlap <= 0) continue;
        const price = getSlotPriceForCourtAndSport(slots, range.startTime, range.endTime, courtId, input.sport, venueDefaultRate);
        const slotHours = Math.max(1, (sEnd - sStart) / 60);
        const isClub = slots.some((s) => s.startTime === range.startTime && s.endTime === range.endTime && s.isClubSlot);
        const hourlyRate = isClub ? price / slotHours : price;
        coveredMin += overlap;
        weightedSum += overlap * hourlyRate;
      }
      if (coveredMin > 0) return Math.round(weightedSum / coveredMin);
      if (slots.length === 0) return venueDefaultRate;
      // Nothing configured actually covers this window — fall back to the day's average.
      const sum = slots.reduce((acc, s) => {
        const sStart = timeToMinutes(s.startTime);
        let sEnd = timeToMinutes(s.endTime);
        if (sEnd <= sStart) sEnd += 1440;
        const slotHours = Math.max(1, (sEnd - sStart) / 60);
        return acc + (s.isClubSlot ? s.price / slotHours : s.price);
      }, 0);
      return Math.round(sum / slots.length);
    };

    // Every court costs its own resolved rate, so taking 2 courts for an hour costs the
    // sum of both — this is the same arithmetic booking-flow.tsx shows at checkout.
    const perHour =
      selectedCourts.length > 0
        ? selectedCourts.reduce((sum, court) => sum + hourlyRateFor(court.id), 0)
        : hourlyRateFor(undefined);
    baseAmount = Math.round((durationMin / 60) * perHour);

    // Last Min Boost. Applied here, at the moment of booking, so the player is charged
    // exactly the discounted price the slot was advertised at — the deal is only live
    // inside the vendor's trigger window, so this deliberately re-checks it server-side
    // rather than trusting whatever the client rendered. Restricted to today's date:
    // the window is a time-of-day comparison, and without this a 5:30 PM shopper would
    // pick up the discount on *tomorrow's* 6 PM slot too.
    const nowIst = new Date();
    if (dateStr === nowIst.toLocaleDateString("en-CA", { timeZone: IST })) {
      const boostRule = findActiveBoostRule(
        listing.lastMinBoosts,
        startTime,
        timeToMinutes(istTimeHHmm(nowIst)),
        input.sport,
        selectedCourts[0]?.id
      );
      if (boostRule) {
        const originalAmount = baseAmount;
        baseAmount = boostedPrice(baseAmount, boostRule.discountPct);
        appliedBoost = {
          ruleId: boostRule.id,
          discountPct: clampBoostPct(boostRule.discountPct),
          originalAmount,
          discountAmount: originalAmount - baseAmount,
        };
      }
    }

    // Also honour slots the vendor has blocked (maintenance etc.) for this date.
    const blockedClash = slots.find(
      (s) => s.blocked && rangesOverlap(startMin, startMin + durationMin, timeToMinutes(s.startTime), timeToMinutes(s.endTime))
    );
    if (blockedClash) {
      throw ApiError.conflict(
        `This time is unavailable — the venue has blocked ${blockedClash.startTime} - ${blockedClash.endTime}.`
      );
    }
    // Turf pricing is always driven by the selected slot(s)/court(s) — never by a
    // package tier — matching booking-flow.tsx's own activePrice logic. Applying the
    // tier here would silently overwrite the slot rate (and any Last Min Boost
    // discount just applied above) with the flat, undiscounted tier price.
  } else if (selectedPriceTier) {
    baseAmount = selectedPriceTier.amount;
  }

  if (input.addOnIds?.length) {
    for (const addOnId of input.addOnIds) {
      const addOn = listing.addOns.find((a) => a.id === addOnId);
      if (!addOn) throw ApiError.badRequest(`Invalid add-on selected: ${addOnId}`);
      baseAmount += addOn.price;
    }
  }

  if (input.playProtect) {
    baseAmount += 19;
  }

  let discountPercent = 0;
  if (input.couponCode) {
    const coupon = listing.coupons.find((c) => c.code.toLowerCase() === input.couponCode?.toLowerCase());
    if (!coupon) throw ApiError.badRequest("Invalid or expired coupon code");
    discountPercent = coupon.discountPercent;
  }

  const pricing = computePricing(baseAmount, discountPercent);
  const orderId = generateOrderId();

  // Partial or Full Payment calculation configured on venue/listing or requested by user
  const partialConfig = listing.partialPayment ?? { enabled: true, type: "percentage", value: 25 };
  const selectedPaymentType: "partial" | "full" =
    input.paymentType ?? (partialConfig.enabled !== false ? "partial" : "full");

  let requiredPaid = pricing.totalAmount;
  if (selectedPaymentType === "partial" && partialConfig.enabled !== false) {
    if (partialConfig.type === "fixed") {
      requiredPaid = Math.min(pricing.totalAmount, Math.max(1, Math.round(partialConfig.value)));
    } else {
      const pct = Math.min(100, Math.max(1, partialConfig.value));
      requiredPaid = Math.min(pricing.totalAmount, Math.max(1, Math.round((pricing.totalAmount * pct) / 100)));
    }
  }

  const chargeNow = requiredPaid;

  let paymentOrderId: string | undefined;
  if (input.payment === "Cashfree (Online)") {
    const order = await paymentProvider.createOrder({
      orderId,
      amount: chargeNow,
      customerName: input.customerName,
      customerEmail: input.email,
      customerPhone: input.phone,
    });
    paymentOrderId = order.providerOrderId;
  }

  if (!listing.vendorId) {
    throw ApiError.badRequest("This listing is not yet assigned to a vendor and cannot accept bookings");
  }

  const created = await BookingModel.create({
    orderId,
    listingId: listing._id,
    vendorId: listing.vendorId,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email,
    sport: input.sport,
    courtId: selectedCourts[0]?.id,
    courtName: selectedCourts[0]?.name,
    courtIds: selectedCourts.length > 0 ? selectedCourts.map((c) => c.id) : undefined,
    courtNames: selectedCourts.length > 0 ? selectedCourts.map((c) => c.name) : undefined,
    dateTime: input.dateTime,
    // Slot end as "HH:mm" (IST) so future availability checks know the real duration.
    endTime:
      listing.type === "Turf"
        ? istTimeHHmm(new Date(new Date(input.dateTime).getTime() + (input.durationMinutes || 60) * 60_000))
        : undefined,
    totalAmount: pricing.totalAmount,
    paidAmount: chargeNow,
    paymentType: selectedPaymentType,
    platformFee: pricing.platformFee,
    taxes: pricing.taxes,
    vendorEarning: pricing.vendorEarning,
    payment: input.payment,
    paymentOrderId,
    paymentStatus: "pending",
    status: "Pending",
    lastMinuteBoost: appliedBoost,
    playProtect: input.playProtect ?? false,
  });
  invalidatePublicListingCache();
  return created;
}

export async function confirmBookingPayment(orderId: string, customerId?: string, paymentId?: string): Promise<BookingDocument> {
  const filter: FilterQuery<BookingDocument> = { orderId };
  if (customerId) filter.customerId = customerId;

  const booking = await BookingModel.findOne(filter);
  if (!booking) throw ApiError.notFound("Booking not found");

  if (booking.status === "Confirmed" || booking.status === "Part Paid" || booking.status === "Completed") {
    return booking;
  }

  if (booking.paymentOrderId) {
    await paymentProvider.verifyPayment(booking.paymentOrderId);
  }

  const isPartial = booking.paymentType === "partial" && (booking.paidAmount ?? 0) < booking.totalAmount;
  booking.paymentStatus = "paid";
  booking.status = isPartial ? "Part Paid" : "Confirmed";
  await booking.save();

  return booking;
}

export interface CreateManualBookingInput {
  listingId: string;
  customerName?: string;
  phone?: string;
  sport?: string;
  courtId?: string;
  numberOfPlayers?: number;
  foodIncluded?: boolean;
  dateTime: Date;
  endTime?: string;
  bookingType?: "regular" | "club_together" | "offline";
  totalAmount: number;
  paidAmount?: number;
  payment?: "Cashfree (Online)" | "Cash (Offline)" | "UPI";
  status?: BookingDocument["status"];
}

/** Lets a vendor record a walk-in/offline booking directly, bypassing the online checkout pricing flow. */
export async function createManualBooking(vendorId: string, input: CreateManualBookingInput): Promise<BookingDocument> {
  const listing = await ListingModel.findOne({ _id: input.listingId, vendorId });
  if (!listing) throw ApiError.notFound("Listing not found for this vendor");

  const court = await resolveManualCourt(listing.courts ?? [], String(listing._id), input);
  const pricing = computePricing(input.totalAmount || 0);

  const isClub = input.bookingType === "club_together";
  const customerName = input.customerName || (isClub ? "Club Booking" : "Walk-in Customer");
  const phone = input.phone || (isClub ? "0000000000" : "0000000000");
  const payment = input.payment || "Cash (Offline)";
  const status = input.status || "Confirmed";

  return BookingModel.create({
    orderId: generateOrderId(),
    listingId: listing._id,
    vendorId,
    customerName,
    phone,
    sport: input.sport,
    courtId: court?.id,
    courtIds: court?.id ? [court.id] : [],
    courtName: court?.name,
    numberOfPlayers: input.numberOfPlayers,
    foodIncluded: input.foodIncluded,
    dateTime: input.dateTime,
    endTime: input.endTime,
    bookingType: input.bookingType || (isClub ? "club_together" : "offline"),
    totalAmount: pricing.totalAmount,
    paidAmount: input.paidAmount !== undefined ? input.paidAmount : pricing.totalAmount,
    platformFee: pricing.platformFee,
    taxes: pricing.taxes,
    vendorEarning: pricing.vendorEarning,
    payment,
    paymentStatus: "paid",
    status,
  });
}

/**
 * Court for a vendor-recorded booking. Unlike checkout this never rejects on a clash:
 * vendors log walk-ins after the fact and sometimes deliberately overlap. An explicit
 * choice is honoured as-is; otherwise we merely *prefer* a court that looks free.
 */
async function resolveManualCourt(
  courts: Court[],
  listingId: string,
  input: CreateManualBookingInput
): Promise<Court | undefined> {
  if (courts.length === 0) return undefined;

  if (input.courtId) {
    const court = courts.find((c) => c.id === input.courtId);
    if (!court) throw ApiError.badRequest("The selected court is not part of this venue");
    return court;
  }

  const candidates = bookableCourts(courts, input.sport);
  if (candidates.length === 0) return undefined;

  const start = new Date(input.dateTime);
  const dateStr = start.toLocaleDateString("en-CA", { timeZone: IST });
  const startMin = timeToMinutes(istTimeHHmm(start));
  const endMin = input.endTime ? timeToMinutes(input.endTime) : startMin + 60;

  const ranges = await getBookedRangesForDate(listingId, dateStr);
  const takenIds = new Set(
    ranges
      .filter((r) => rangesOverlap(startMin, endMin, timeToMinutes(r.startTime), timeToMinutes(r.endTime)))
      .map((r) => r.courtId || courts[0]!.id)
  );

  return candidates.find((c) => !takenIds.has(c.id)) ?? candidates[0];
}

export async function listBookingsForCustomer(customerId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<BookingDocument> = { customerId };
  if (filters.status) filter.status = filters.status;
  return paginate(filter, filters);
}

export async function listBookingsForVendor(vendorId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<BookingDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  return paginate(filter, filters);
}

export async function listBookingsForAdmin(filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<BookingDocument> = {};
  if (filters.status) filter.status = filters.status;
  return paginate(filter, filters, { populateListing: true });
}

async function paginate(
  filter: FilterQuery<BookingDocument>,
  { page, limit }: { page: number; limit: number },
  options: { populateListing?: boolean } = {}
) {
  const skip = (page - 1) * limit;
  let query = BookingModel.find(filter).sort({ dateTime: -1 }).skip(skip).limit(limit).lean();
  if (options.populateListing) query = query.populate("listingId", "title");
  const [items, total] = await Promise.all([query, BookingModel.countDocuments(filter)]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getBookingByOrderId(orderId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<BookingDocument> = { orderId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const booking = await BookingModel.findOne(filter);
  if (!booking) throw ApiError.notFound("Booking not found");
  return booking;
}

export async function updateBookingStatus(
  orderId: string,
  status: BookingDocument["status"],
  scope: { vendorId?: string },
  cancellationReason?: string
) {
  const booking = await getBookingByOrderId(orderId, scope);
  booking.status = status;
  if (status === "Cancelled" && cancellationReason) booking.cancellationReason = cancellationReason;
  if (status === "Completed" && booking.payment !== "Cashfree (Online)") booking.paymentStatus = "paid";
  await booking.save();
  return booking;
}

export async function cancelOwnBooking(orderId: string, customerId: string, reason?: string) {
  const booking = await getBookingByOrderId(orderId, { customerId });
  if (booking.status === "Completed") {
    throw ApiError.badRequest("A completed booking cannot be cancelled");
  }
  booking.status = "Cancelled";
  booking.cancellationReason = reason;
  await booking.save();
  return booking;
}

/** QR check-in: the QR a player receives simply encodes the orderId. Scanning it calls this. */
export async function checkInBooking(orderId: string, vendorId: string) {
  const booking = await getBookingByOrderId(orderId, { vendorId });

  if (booking.status === "Cancelled") {
    throw ApiError.badRequest("This booking was cancelled and cannot be checked in");
  }
  if (booking.checkedIn) {
    return { booking, alreadyCheckedIn: true };
  }

  booking.checkedIn = true;
  booking.checkedInAt = new Date();
  await booking.save();
  return { booking, alreadyCheckedIn: false };
}






