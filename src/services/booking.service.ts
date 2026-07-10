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
  durationMinutes?: number;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDocument> {
  const listing = await ListingModel.findOne({ _id: input.listingId, status: "Active", isPrivate: false });
  if (!listing) throw ApiError.notFound("Listing not found or unavailable");

  let baseAmount = listing.price;
  if (listing.type === "Turf") {
    const bDate = new Date(input.dateTime);
    const dateStr = bDate.toISOString().slice(0, 10);

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
    dateTime: input.dateTime,
    totalAmount: pricing.totalAmount,
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
  dateTime: Date;
  totalAmount: number;
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
    dateTime: input.dateTime,
    totalAmount: pricing.totalAmount,
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
