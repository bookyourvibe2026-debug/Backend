import { FilterQuery } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CoachDocument, CoachModel, CoachSlot } from "../models/Coach.model";
import { CoachBookingDocument, CoachBookingModel } from "../models/CoachBooking.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";
import { paymentProvider } from "./payment/payment.service";

export interface CreateCoachInput {
  name: string;
  category: string;
  subCategory?: string;
  experienceYears?: number;
  fees: number;
  bio?: string;
  photoUrl?: string;
  status?: "Active" | "Inactive";
}

export async function createCoach(vendorId: string, input: CreateCoachInput) {
  return CoachModel.create({ ...input, vendorId, slots: [] });
}

export async function getCoachForVendor(vendorId: string, coachId: string) {
  const coach = await CoachModel.findOne({ _id: coachId, vendorId });
  if (!coach) throw ApiError.notFound("Coach not found");
  return coach;
}

export async function updateCoach(vendorId: string, coachId: string, input: Partial<CreateCoachInput>) {
  const coach = await getCoachForVendor(vendorId, coachId);
  coach.set(input);
  await coach.save();
  return coach;
}

export async function deleteCoach(vendorId: string, coachId: string) {
  const coach = await CoachModel.findOneAndDelete({ _id: coachId, vendorId });
  if (!coach) throw ApiError.notFound("Coach not found");
}

export async function listCoachesForVendor(vendorId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<CoachDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  return paginateCoaches(filter, filters);
}

export async function listPublicCoaches(filters: { category?: string; vendorId?: string; page: number; limit: number }) {
  const filter: FilterQuery<CoachDocument> = { status: "Active" };
  if (filters.category) filter.category = filters.category;
  if (filters.vendorId) filter.vendorId = filters.vendorId;
  return paginateCoaches(filter, filters);
}

export async function getPublicCoachById(coachId: string) {
  const coach = await CoachModel.findOne({ _id: coachId, status: "Active" });
  if (!coach) throw ApiError.notFound("Coach not found");

  const now = new Date();
  const openSlots = coach.slots.filter((slot) => !slot.isBooked && slot.date >= now);
  return { ...coach.toObject(), slots: openSlots };
}

async function paginateCoaches(
  filter: FilterQuery<CoachDocument>,
  { page, limit }: { page: number; limit: number }
) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    CoachModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CoachModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function addSlot(vendorId: string, coachId: string, input: { date: Date; startTime: string; endTime: string }) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const slot: CoachSlot = { id: uuidv4(), date: input.date, startTime: input.startTime, endTime: input.endTime, isBooked: false };
  coach.slots.push(slot);
  await coach.save();
  return coach;
}

export async function removeSlot(vendorId: string, coachId: string, slotId: string) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const slot = coach.slots.find((s) => s.id === slotId);
  if (!slot) throw ApiError.notFound("Slot not found");
  if (slot.isBooked) throw ApiError.badRequest("This slot already has a booking and cannot be removed");
  coach.slots = coach.slots.filter((s) => s.id !== slotId);
  await coach.save();
  return coach;
}

export interface BookCoachSlotInput {
  coachId: string;
  slotId: string;
  customerId?: string;
  customerName: string;
  phone: string;
  email?: string;
  payment: "Cashfree (Online)" | "Cash (Offline)" | "UPI";
}

export async function bookCoachSlot(input: BookCoachSlotInput): Promise<CoachBookingDocument> {
  // Atomically claim the slot so two concurrent bookers can't both win it.
  const coach = await CoachModel.findOneAndUpdate(
    { _id: input.coachId, status: "Active", "slots.id": input.slotId, "slots.isBooked": false },
    { $set: { "slots.$.isBooked": true } },
    { new: true }
  );
  if (!coach) throw ApiError.badRequest("This slot is no longer available");

  const slot = coach.slots.find((s) => s.id === input.slotId)!;
  const orderId = generateOrderId();

  let paymentOrderId: string | undefined;
  if (input.payment === "Cashfree (Online)") {
    const order = await paymentProvider.createOrder({
      orderId,
      amount: coach.fees,
      customerName: input.customerName,
      customerEmail: input.email,
      customerPhone: input.phone,
    });
    paymentOrderId = order.providerOrderId;
  }

  try {
    return await CoachBookingModel.create({
      orderId,
      coachId: coach._id,
      vendorId: coach.vendorId,
      customerId: input.customerId ?? null,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email,
      slotId: slot.id,
      slotDate: slot.date,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      amount: coach.fees,
      payment: input.payment,
      paymentOrderId,
      paymentStatus: "pending",
      status: "Confirmed",
    });
  } catch (err) {
    // Booking record failed after the slot was claimed — release it back rather than strand it.
    await CoachModel.updateOne({ _id: coach._id, "slots.id": slot.id }, { $set: { "slots.$.isBooked": false } });
    throw err;
  }
}

export async function listMyCoachBookings(customerId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<CoachBookingDocument> = { customerId };
  if (filters.status) filter.status = filters.status;
  return paginateCoachBookings(filter, filters);
}

export async function listCoachBookingsForVendor(
  vendorId: string,
  filters: { status?: string; coachId?: string; page: number; limit: number }
) {
  const filter: FilterQuery<CoachBookingDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  if (filters.coachId) filter.coachId = filters.coachId;
  return paginateCoachBookings(filter, filters);
}

async function paginateCoachBookings(
  filter: FilterQuery<CoachBookingDocument>,
  { page, limit }: { page: number; limit: number }
) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    CoachBookingModel.find(filter).sort({ slotDate: -1 }).skip(skip).limit(limit),
    CoachBookingModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getCoachBookingByOrderId(orderId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<CoachBookingDocument> = { orderId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const booking = await CoachBookingModel.findOne(filter);
  if (!booking) throw ApiError.notFound("Coach booking not found");
  return booking;
}

export async function cancelMyCoachBooking(orderId: string, customerId: string, reason?: string) {
  const booking = await getCoachBookingByOrderId(orderId, { customerId });
  if (booking.status === "Completed") {
    throw ApiError.badRequest("A completed session cannot be cancelled");
  }
  booking.status = "Cancelled";
  booking.cancellationReason = reason;
  await booking.save();

  await CoachModel.updateOne(
    { _id: booking.coachId, "slots.id": booking.slotId },
    { $set: { "slots.$.isBooked": false } }
  );

  return booking;
}

/** Same convention as turf-booking QR check-in: the "QR" simply encodes the orderId. */
export async function checkInCoachBooking(orderId: string, vendorId: string) {
  const booking = await getCoachBookingByOrderId(orderId, { vendorId });

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
