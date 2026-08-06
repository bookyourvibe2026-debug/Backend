import { FilterQuery } from "mongoose";
import { FoodOutletDocument, FoodOutletModel } from "../models/FoodOutlet.model";
import { TableBookingDocument, TableBookingModel, TableBookingStatus } from "../models/TableBooking.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";

/** Reservations that still hold a table — everything else frees the slot back up. */
const HOLDS_A_TABLE: TableBookingStatus[] = ["Pending", "Confirmed", "Seated"];

/** Statuses still ahead of the restaurant; the rest are closed out. */
const OPEN_STATUSES: TableBookingStatus[] = ["Pending", "Confirmed", "Seated"];
const CLOSED_STATUSES: TableBookingStatus[] = ["Completed", "Rejected", "Cancelled", "NoShow"];

/** Midnight of the given day, so a day's reservations group under one key. */
function dayStart(date: Date | string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface BookingSlot {
  time: string;
  /** Tables still free in this slot. */
  seatsLeft: number;
  available: boolean;
  /** Why it can't be booked, when it can't. */
  reason?: string;
}

/**
 * Bookable slots for one day at one restaurant.
 *
 * Slots come from the outlet's weekly opening hours, stepped by its slot length, minus
 * whatever is already reserved. Today's slots that have already started drop off, and a
 * full-day closure empties the list.
 */
export async function getBookingSlots(outletIdOrSlug: string, dateInput: string) {
  const outlet = await findPublicOutlet(outletIdOrSlug);
  if (!outlet.dineout?.tableBooking) {
    throw ApiError.badRequest("This restaurant is not taking table bookings right now");
  }

  const date = dayStart(dateInput);
  const today = dayStart(new Date());
  if (date < today) throw ApiError.badRequest("Pick a date from today onwards");

  const advanceDays = outlet.dineout.advanceDays ?? 30;
  const lastBookable = dayStart(new Date());
  lastBookable.setDate(lastBookable.getDate() + advanceDays);
  if (date > lastBookable) {
    throw ApiError.badRequest(`Bookings open up to ${advanceDays} days ahead`);
  }

  // A full-day closure means no slots at all; a half-day still runs on normal hours.
  const closure = (outlet.leaves ?? []).find(
    (l) => dayStart(l.date).getTime() === date.getTime() && l.type === "full"
  );
  if (closure) {
    return { date: date.toISOString(), slots: [] as BookingSlot[], closed: true, reason: closure.reason };
  }

  const day = (outlet.weeklyAvailability ?? []).find((d) => d.day === date.getDay());
  if (day && !day.isOpen) {
    return { date: date.toISOString(), slots: [] as BookingSlot[], closed: true, reason: "Closed on this day" };
  }

  const openMins = toMinutes(day?.startTime ?? "09:00");
  const closeMins = toMinutes(day?.endTime ?? "22:00");
  const step = outlet.dineout.slotMinutes ?? 60;
  const tables = outlet.dineout.tablesPerSlot ?? 10;

  // Booked counts for the whole day in one query, then bucketed by slot.
  const booked = await TableBookingModel.aggregate<{ _id: string; count: number }>([
    { $match: { outletId: outlet._id, date, status: { $in: HOLDS_A_TABLE } } },
    { $group: { _id: "$slotTime", count: { $sum: 1 } } },
  ]);
  const bookedBySlot = new Map(booked.map((b) => [b._id, b.count]));

  // Give the kitchen a little lead time rather than offering a slot starting this minute.
  const isToday = date.getTime() === today.getTime();
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const earliest = isToday ? nowMins + 30 : -1;

  const slots: BookingSlot[] = [];
  // Stop a full slot before closing so the last party isn't seated at the door.
  for (let t = openMins; t + step <= closeMins; t += step) {
    const time = toHHmm(t);
    const used = bookedBySlot.get(time) ?? 0;
    const seatsLeft = Math.max(0, tables - used);

    if (t < earliest) {
      slots.push({ time, seatsLeft, available: false, reason: "Too soon" });
    } else if (seatsLeft === 0) {
      slots.push({ time, seatsLeft, available: false, reason: "Fully booked" });
    } else {
      slots.push({ time, seatsLeft, available: true });
    }
  }

  return { date: date.toISOString(), slots, closed: false };
}

async function findPublicOutlet(idOrSlug: string): Promise<FoodOutletDocument> {
  const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
  const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const outlet = await FoodOutletModel.findOne({ ...query, status: "Active" });
  if (!outlet) throw ApiError.notFound("Restaurant not found");
  return outlet;
}

export async function createTableBooking(input: {
  customerId: string;
  customerName: string;
  phone: string;
  outletId: string;
  date: string;
  slotTime: string;
  partySize: number;
  seatingPreference?: string;
  selectedOfferCode?: string;
  occasion?: string;
  specialRequests?: string;
}) {
  const outlet = await findPublicOutlet(input.outletId);
  if (!outlet.dineout?.tableBooking) {
    throw ApiError.badRequest("This restaurant is not taking table bookings right now");
  }

  const maxParty = outlet.dineout.maxPartySize ?? 20;
  if (input.partySize > maxParty) {
    throw ApiError.badRequest(`This restaurant seats up to ${maxParty} guests per booking`);
  }

  // Re-derive availability rather than trusting the slot list the client was shown.
  const { slots, closed } = await getBookingSlots(input.outletId, input.date);
  if (closed) throw ApiError.badRequest("This restaurant is closed on that day");

  const slot = slots.find((s) => s.time === input.slotTime);
  if (!slot) throw ApiError.badRequest("Pick a valid time slot");
  if (!slot.available) {
    throw ApiError.badRequest(slot.reason === "Too soon" ? "That slot has already passed" : "That slot is fully booked");
  }

  const status: TableBookingStatus = outlet.dineout.autoConfirm ? "Confirmed" : "Pending";

  return TableBookingModel.create({
    bookingId: generateOrderId(),
    vendorId: outlet.vendorId,
    outletId: outlet._id,
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    date: dayStart(input.date),
    slotTime: input.slotTime,
    partySize: input.partySize,
    seatingPreference: input.seatingPreference,
    selectedOfferCode: input.selectedOfferCode,
    occasion: input.occasion,
    specialRequests: input.specialRequests,
    status,
  });
}

export async function listTableBookingsForCustomer(customerId: string, filters: { page: number; limit: number }) {
  return paginate({ customerId }, filters);
}

export async function listTableBookingsForVendor(
  vendorId: string,
  filters: {
    status?: string;
    outletId?: string;
    scope?: "upcoming" | "history";
    date?: string;
    page: number;
    limit: number;
  }
) {
  const filter: FilterQuery<TableBookingDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  else if (filters.scope === "upcoming") filter.status = { $in: OPEN_STATUSES };
  else if (filters.scope === "history") filter.status = { $in: CLOSED_STATUSES };
  if (filters.outletId) filter.outletId = filters.outletId;
  if (filters.date) filter.date = dayStart(filters.date);
  return paginate(filter, filters);
}

async function paginate(filter: FilterQuery<TableBookingDocument>, { page, limit }: { page: number; limit: number }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    TableBookingModel.find(filter).sort({ date: -1, slotTime: -1 }).skip(skip).limit(limit).lean(),
    TableBookingModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getTableBooking(bookingId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<TableBookingDocument> = { bookingId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const booking = await TableBookingModel.findOne(filter);
  if (!booking) throw ApiError.notFound("Table booking not found");
  return booking;
}

export async function updateTableBookingStatus(
  bookingId: string,
  status: TableBookingStatus,
  vendorId: string,
  rejectionReason?: string
) {
  const booking = await getTableBooking(bookingId, { vendorId });
  if (CLOSED_STATUSES.includes(booking.status)) {
    throw ApiError.badRequest(`This booking is already ${booking.status.toLowerCase()} and cannot be updated`);
  }
  booking.status = status;
  if (rejectionReason) booking.rejectionReason = rejectionReason;
  await booking.save();
  return booking;
}

/** The player cancels their own reservation, up to the point they've been seated. */
export async function cancelTableBooking(bookingId: string, customerId: string) {
  const booking = await getTableBooking(bookingId, { customerId });
  if (booking.status === "Seated" || booking.status === "Completed") {
    throw ApiError.badRequest("You're already at the table — talk to the restaurant instead");
  }
  if (CLOSED_STATUSES.includes(booking.status)) {
    throw ApiError.badRequest(`This booking is already ${booking.status.toLowerCase()}`);
  }
  booking.status = "Cancelled";
  await booking.save();
  return booking;
}

/** Scanning the booking QR at the door seats the party. */
export async function checkInTableBooking(bookingId: string, vendorId: string) {
  const booking = await getTableBooking(bookingId, { vendorId });

  if (CLOSED_STATUSES.includes(booking.status)) {
    throw ApiError.badRequest(`This booking was ${booking.status.toLowerCase()} and cannot be checked in`);
  }
  if (booking.checkedIn) return { booking, alreadyCheckedIn: true };

  booking.checkedIn = true;
  booking.checkedInAt = new Date();
  booking.status = "Seated";
  await booking.save();
  return { booking, alreadyCheckedIn: false };
}
