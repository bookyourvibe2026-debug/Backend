import { FilterQuery, PipelineStage, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CoachBatch, CoachDocument, CoachModel, CoachWeeklyDay } from "../models/Coach.model";
import {
  CoachSubscriptionDocument,
  CoachSubscriptionModel,
  CoachSubscriptionPlan,
} from "../models/CoachSubscription.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";
import { paymentProvider } from "./payment/payment.service";

/* --------------------------------- Coach CRUD --------------------------------- */

export interface CoachLocationInput {
  address?: string;
  area?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export type InlineBatchInput = Omit<CoachBatch, "id">;

export interface CreateCoachInput {
  name: string;
  category: string;
  categories?: string[];
  subCategory?: string;
  phone?: string;
  email?: string;
  experienceYears?: number;
  fees?: number;
  bio?: string;
  photoUrl?: string;
  gallery?: string[];
  status?: "Active" | "Inactive";
  location?: CoachLocationInput;
  /** Slots/batches created together with the coach in a single save. */
  batches?: InlineBatchInput[];
}

export async function createCoach(vendorId: string, input: CreateCoachInput) {
  const { batches, ...rest } = input;
  const withIds = (batches ?? []).map((b) => ({ id: uuidv4(), ...b }));
  return CoachModel.create({ ...rest, vendorId, batches: withIds });
}

export async function getCoachForVendor(vendorId: string, coachId: string) {
  const coach = await CoachModel.findOne({ _id: coachId, vendorId });
  if (!coach) throw ApiError.notFound("Coach not found");
  return coach;
}

export async function updateCoach(vendorId: string, coachId: string, input: Partial<CreateCoachInput>) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const { batches, ...rest } = input;
  coach.set(rest);
  if (batches) {
    coach.batches = batches.map((b) => ({ id: (b as CoachBatch).id ?? uuidv4(), ...b })) as CoachBatch[];
  }
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

/* ----------------------------- Weekly availability ----------------------------- */

export async function setWeeklyAvailability(vendorId: string, coachId: string, days: CoachWeeklyDay[]) {
  const coach = await getCoachForVendor(vendorId, coachId);
  coach.weeklyAvailability = days;
  await coach.save();
  return coach;
}

/* --------------------------------- Batches --------------------------------- */

export type BatchInput = Omit<CoachBatch, "id">;

export async function addBatch(vendorId: string, coachId: string, input: BatchInput) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const batch: CoachBatch = { id: uuidv4(), ...input };
  coach.batches.push(batch);
  await coach.save();
  return coach;
}

export async function updateBatch(vendorId: string, coachId: string, batchId: string, input: Partial<BatchInput>) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const batch = coach.batches.find((b) => b.id === batchId);
  if (!batch) throw ApiError.notFound("Batch not found");
  Object.assign(batch, input);
  await coach.save();
  return coach;
}

export async function removeBatch(vendorId: string, coachId: string, batchId: string) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const activeSubs = await CoachSubscriptionModel.countDocuments({ coachId, batchId, status: "Active" });
  if (activeSubs > 0) throw ApiError.badRequest("This batch has active students and cannot be removed");
  coach.batches = coach.batches.filter((b) => b.id !== batchId);
  await coach.save();
  return coach;
}

/* ---------------------------------- Leaves ---------------------------------- */

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function addLeave(vendorId: string, coachId: string, input: { date: Date; type?: "full" | "half"; reason?: string }) {
  const coach = await getCoachForVendor(vendorId, coachId);
  // Re-marking the same date updates its type/reason instead of duplicating.
  coach.leaves = coach.leaves.filter((l) => !sameDay(new Date(l.date), new Date(input.date)));
  coach.leaves.push({ date: input.date, type: input.type ?? "full", reason: input.reason });
  await coach.save();
  return coach;
}

export async function removeLeave(vendorId: string, coachId: string, isoDate: string) {
  const coach = await getCoachForVendor(vendorId, coachId);
  const target = new Date(isoDate);
  coach.leaves = coach.leaves.filter((l) => !sameDay(new Date(l.date), target));
  await coach.save();
  return coach;
}

/* ------------------------------- Public browse ------------------------------- */

export interface PublicCoachFilters {
  category?: string;
  vendorId?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page: number;
  limit: number;
}

/**
 * Public coach listing. When lat/lng are supplied we sort by distance (nearest
 * first) via $geoNear and attach a distanceKm to each card; otherwise fall back
 * to a plain city/category filter sorted by recency.
 */
export async function listPublicCoaches(filters: PublicCoachFilters) {
  const match: FilterQuery<CoachDocument> = { status: "Active" };
  // Match either the legacy primary category or any sport in the multi-sport list.
  if (filters.category) match.$or = [{ category: filters.category }, { categories: filters.category }];
  if (filters.vendorId) match.vendorId = new Types.ObjectId(filters.vendorId);
  if (filters.city) match["location.city"] = new RegExp(`^${escapeRegex(filters.city)}$`, "i");

  const skip = (filters.page - 1) * filters.limit;

  if (typeof filters.lat === "number" && typeof filters.lng === "number") {
    const maxDistance = (filters.radiusKm ?? 50) * 1000; // metres
    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [filters.lng, filters.lat] },
          distanceField: "distanceMeters",
          maxDistance,
          spherical: true,
          query: match,
        },
      },
    ];
    const [items, countResult] = await Promise.all([
      CoachModel.aggregate([...pipeline, { $skip: skip }, { $limit: filters.limit }]),
      CoachModel.aggregate([...pipeline, { $count: "total" }]),
    ]);
    const total = countResult[0]?.total ?? 0;
    const withDistance = items.map((c) => ({
      ...c,
      distanceKm: typeof c.distanceMeters === "number" ? Math.round((c.distanceMeters / 1000) * 10) / 10 : undefined,
    }));
    return { items: withDistance, total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) };
  }

  const [items, total] = await Promise.all([
    CoachModel.find(match).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
    CoachModel.countDocuments(match),
  ]);
  return { items, total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) };
}

/** Coach profile for customers, with live spots-left per batch and upcoming holidays. Accepts either the coach's real id or its public slug. */
export async function getPublicCoachById(coachId: string) {
  const query = Types.ObjectId.isValid(coachId) ? { _id: coachId } : { slug: coachId.toLowerCase() };
  const coach = await CoachModel.findOne({ ...query, status: "Active" }).lean();
  if (!coach) throw ApiError.notFound("Coach not found");

  const counts = await CoachSubscriptionModel.aggregate<{ _id: string; count: number }>([
    { $match: { coachId: coach._id, status: "Active" } },
    { $group: { _id: "$batchId", count: { $sum: 1 } } },
  ]);
  const enrolledByBatch = new Map(counts.map((c) => [c._id, c.count]));

  const batches = (coach.batches ?? []).map((b) => {
    const enrolled = enrolledByBatch.get(b.id) ?? 0;
    return { ...b, enrolled, spotsLeft: Math.max(0, b.capacity - enrolled) };
  });

  // Only surface today-or-future leaves to customers.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcomingLeaves = (coach.leaves ?? []).filter((l) => new Date(l.date) >= todayStart);

  return { ...coach, batches, leaves: upcomingLeaves };
}

/* ------------------------------- Subscriptions ------------------------------- */

export interface EnrollInput {
  coachId: string;
  batchId: string;
  plan: CoachSubscriptionPlan;
  customerId?: string;
  customerName: string;
  phone: string;
  email?: string;
  payment: "Cashfree (Online)" | "Cash (Offline)" | "UPI";
}

function planPrice(batch: CoachBatch, plan: CoachSubscriptionPlan): number {
  if (plan === "demo") return 0;
  return plan === "yearly" ? batch.priceYearly : batch.priceMonthly;
}

function planEndDate(plan: CoachSubscriptionPlan, start: Date): Date | null {
  if (plan === "demo") return null;
  const end = new Date(start);
  if (plan === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export async function enrollInBatch(input: EnrollInput): Promise<CoachSubscriptionDocument> {
  const coach = await CoachModel.findOne({ _id: input.coachId, status: "Active" });
  if (!coach) throw ApiError.badRequest("Coach is not available");

  const batch = coach.batches.find((b) => b.id === input.batchId);
  if (!batch || !batch.active) throw ApiError.badRequest("This batch is not available");
  if (input.plan === "demo" && !batch.demoAvailable) throw ApiError.badRequest("Demo is not available for this batch");

  // Capacity guard — count active students in this batch before claiming a seat.
  const enrolled = await CoachSubscriptionModel.countDocuments({
    coachId: coach._id,
    batchId: batch.id,
    status: "Active",
  });
  if (enrolled >= batch.capacity) throw ApiError.badRequest("This batch is full");

  const amount = planPrice(batch, input.plan);
  const start = new Date();
  const orderId = generateOrderId();

  let paymentOrderId: string | undefined;
  if (input.payment === "Cashfree (Online)" && amount > 0) {
    const order = await paymentProvider.createOrder({
      orderId,
      amount,
      customerName: input.customerName,
      customerEmail: input.email,
      customerPhone: input.phone,
    });
    paymentOrderId = order.providerOrderId;
  }

  return CoachSubscriptionModel.create({
    orderId,
    coachId: coach._id,
    vendorId: coach.vendorId,
    batchId: batch.id,
    batchName: batch.name,
    customerId: input.customerId ?? null,
    customerName: input.customerName,
    phone: input.phone,
    email: input.email,
    plan: input.plan,
    amount,
    startDate: start,
    endDate: planEndDate(input.plan, start),
    payment: input.payment,
    paymentOrderId,
    paymentStatus: amount === 0 ? "paid" : "pending",
    status: "Active",
  });
}

export async function listMySubscriptions(customerId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<CoachSubscriptionDocument> = { customerId };
  if (filters.status) filter.status = filters.status;
  return paginateSubscriptions(filter, filters);
}

export async function listSubscriptionsForVendor(
  vendorId: string,
  filters: { status?: string; coachId?: string; page: number; limit: number }
) {
  const filter: FilterQuery<CoachSubscriptionDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  if (filters.coachId) filter.coachId = filters.coachId;
  return paginateSubscriptions(filter, filters);
}

async function paginateSubscriptions(
  filter: FilterQuery<CoachSubscriptionDocument>,
  { page, limit }: { page: number; limit: number }
) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    CoachSubscriptionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CoachSubscriptionModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getSubscriptionByOrderId(orderId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<CoachSubscriptionDocument> = { orderId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const sub = await CoachSubscriptionModel.findOne(filter);
  if (!sub) throw ApiError.notFound("Subscription not found");
  return sub;
}

export async function cancelMySubscription(orderId: string, customerId: string, reason?: string) {
  const sub = await getSubscriptionByOrderId(orderId, { customerId });
  if (sub.status !== "Active") throw ApiError.badRequest("This subscription is not active");
  sub.status = "Cancelled";
  sub.cancellationReason = reason;
  await sub.save();
  return sub;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
