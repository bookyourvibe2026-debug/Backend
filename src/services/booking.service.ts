import { FilterQuery } from "mongoose";
import { env } from "../config/env";
import { BookingDocument, BookingModel } from "../models/Booking.model";
import { ListingModel } from "../models/Listing.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";
import { paymentProvider } from "./payment/payment.service";

interface PricingResult {
  totalAmount: number;
  platformFee: number;
  taxes: number;
  vendorEarning: number;
}

function computePricing(baseAmount: number, discountPercent = 0): PricingResult {
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
  customerId?: string;
  sport?: string;
  durationMinutes?: number;
}

/* ── Slot availability ──
 * Bookings store their slot start as a UTC instant plus an optional "HH:mm" end;
 * everything below works in IST because that's the timezone slots are sold in. */
const IST = "Asia/Kolkata";

function istTimeHHmm(d: Date): string {
  return d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false });
}

function timeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

export interface BookedRange {
  startTime: string;
  endTime: string;
  status: "Confirmed" | "Pending" | "Completed";
}

/** Non-cancelled bookings for one listing on one IST calendar date, as HH:mm ranges. */
export async function getBookedRangesForDate(listingId: string, date: string): Promise<BookedRange[]> {
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const bookings = await BookingModel.find({
    listingId,
    status: { $ne: "Cancelled" },
    dateTime: { $gte: dayStart, $lt: dayEnd },
  }).select("dateTime endTime status");

  return bookings.map((b) => ({
    startTime: istTimeHHmm(b.dateTime),
    // Legacy bookings without a stored end are assumed to run one hour.
    endTime: b.endTime || istTimeHHmm(new Date(b.dateTime.getTime() + 60 * 60_000)),
    status: b.status as BookedRange["status"],
  }));
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  // Ranges crossing midnight (end <= start) extend into the next day.
  const aE = aEnd <= aStart ? aEnd + 1440 : aEnd;
  const bE = bEnd <= bStart ? bEnd + 1440 : bEnd;
  return aStart < bE && bStart < aE;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDocument> {
  const listing = await ListingModel.findOne({ _id: input.listingId, status: "Active", isPrivate: false });
  if (!listing) throw ApiError.notFound("Listing not found or unavailable");

  let baseAmount = listing.price;
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

    let baseHourlyRate = listing.price || 1000;
    if (slots.length > 0) {
      let sum = 0;
      slots.forEach((s) => {
        sum += s.price;
      });
      baseHourlyRate = Math.round(sum / slots.length);
    }

    const durationMin = input.durationMinutes || 60;
    baseAmount = Math.round((durationMin / 60) * baseHourlyRate);

    // Reject any slot that overlaps an existing non-cancelled booking.
    const startTime = istTimeHHmm(bDate);
    const startMin = timeToMinutes(startTime);
    const bookedRanges = await getBookedRangesForDate(input.listingId, dateStr);
    const clash = bookedRanges.find((r) =>
      rangesOverlap(startMin, startMin + durationMin, timeToMinutes(r.startTime), timeToMinutes(r.endTime))
    );
    if (clash) {
      throw ApiError.conflict(
        `This time overlaps an existing booking (${clash.startTime} - ${clash.endTime}). Please pick a different slot.`
      );
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
  } else if (input.priceTierId) {
    const tier = listing.priceTiers.find((t) => t.id === input.priceTierId);
    if (!tier) throw ApiError.badRequest("Selected price tier is not valid for this listing");
    baseAmount = tier.amount;
  }

  if (input.addOnIds?.length) {
    for (const addOnId of input.addOnIds) {
      const addOn = listing.addOns.find((a) => a.id === addOnId);
      if (!addOn) throw ApiError.badRequest(`Invalid add-on selected: ${addOnId}`);
      baseAmount += addOn.price;
    }
  }

  let discountPercent = 0;
  if (input.couponCode) {
    const coupon = listing.coupons.find((c) => c.code.toLowerCase() === input.couponCode?.toLowerCase());
    if (!coupon) throw ApiError.badRequest("Invalid or expired coupon code");
    discountPercent = coupon.discountPercent;
  }

  const pricing = computePricing(baseAmount, discountPercent);
  const orderId = generateOrderId();

  let paymentOrderId: string | undefined;
  if (input.payment === "Cashfree (Online)") {
    const order = await paymentProvider.createOrder({
      orderId,
      amount: pricing.totalAmount,
      customerName: input.customerName,
      customerEmail: input.email,
      customerPhone: input.phone,
    });
    paymentOrderId = order.providerOrderId;
  }

  if (!listing.vendorId) {
    throw ApiError.badRequest("This listing is not yet assigned to a vendor and cannot accept bookings");
  }

  return BookingModel.create({
    orderId,
    listingId: listing._id,
    vendorId: listing.vendorId,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email,
    sport: input.sport,
    dateTime: input.dateTime,
    // Slot end as "HH:mm" (IST) so future availability checks know the real duration.
    endTime:
      listing.type === "Turf"
        ? istTimeHHmm(new Date(new Date(input.dateTime).getTime() + (input.durationMinutes || 60) * 60_000))
        : undefined,
    totalAmount: pricing.totalAmount,
    paidAmount: pricing.totalAmount,
    platformFee: pricing.platformFee,
    taxes: pricing.taxes,
    vendorEarning: pricing.vendorEarning,
    payment: input.payment,
    paymentOrderId,
    paymentStatus: input.payment === "Cashfree (Online)" ? "pending" : "pending",
    status: "Pending",
  });
}

export interface CreateManualBookingInput {
  listingId: string;
  customerName: string;
  phone: string;
  sport?: string;
  numberOfPlayers?: number;
  foodIncluded?: boolean;
  dateTime: Date;
  endTime?: string;
  totalAmount: number;
  paidAmount?: number;
  payment: "Cashfree (Online)" | "Cash (Offline)" | "UPI";
  status: BookingDocument["status"];
}

/** Lets a vendor record a walk-in/offline booking directly, bypassing the online checkout pricing flow. */
export async function createManualBooking(vendorId: string, input: CreateManualBookingInput): Promise<BookingDocument> {
  const listing = await ListingModel.findOne({ _id: input.listingId, vendorId });
  if (!listing) throw ApiError.notFound("Listing not found for this vendor");

  const pricing = computePricing(input.totalAmount);

  return BookingModel.create({
    orderId: generateOrderId(),
    listingId: listing._id,
    vendorId,
    customerName: input.customerName,
    phone: input.phone,
    sport: input.sport,
    numberOfPlayers: input.numberOfPlayers,
    foodIncluded: input.foodIncluded,
    dateTime: input.dateTime,
    endTime: input.endTime,
    totalAmount: pricing.totalAmount,
    paidAmount: input.paidAmount !== undefined ? input.paidAmount : pricing.totalAmount,
    platformFee: pricing.platformFee,
    taxes: pricing.taxes,
    vendorEarning: pricing.vendorEarning,
    payment: input.payment,
    paymentStatus: "paid",
    status: input.status,
  });
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
  let query = BookingModel.find(filter).sort({ dateTime: -1 }).skip(skip).limit(limit);
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
