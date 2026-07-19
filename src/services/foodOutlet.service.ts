import { FilterQuery, Types } from "mongoose";
import { FoodOutletModel, FoodOutletDocument, OutletWeeklyDay } from "../models/FoodOutlet.model";
import { MenuItemModel } from "../models/MenuItem.model";
import { ApiError } from "../utils/ApiError";

export interface OutletLocationInput {
  address?: string;
  area?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface CreateOutletInput {
  name: string;
  kind?: "dining" | "venue";
  offer?: string;
  description?: string;
  cuisines?: string[];
  logo?: string;
  banner?: string;
  poster?: string;
  gallery?: string[];
  location?: OutletLocationInput;
  status?: "Active" | "Inactive";
}

export async function createOutlet(vendorId: string, input: CreateOutletInput) {
  return FoodOutletModel.create({ ...input, vendorId });
}

export async function listOutletsForVendor(vendorId: string) {
  return FoodOutletModel.find({ vendorId }).sort({ createdAt: 1 });
}

export async function getOutletForVendor(vendorId: string, outletId: string) {
  const outlet = await FoodOutletModel.findOne({ _id: outletId, vendorId });
  if (!outlet) throw ApiError.notFound("Outlet not found");
  return outlet;
}

export async function updateOutlet(vendorId: string, outletId: string, input: Partial<CreateOutletInput>) {
  const outlet = await getOutletForVendor(vendorId, outletId);
  outlet.set(input);
  await outlet.save();
  return outlet;
}

export async function deleteOutlet(vendorId: string, outletId: string) {
  const itemCount = await MenuItemModel.countDocuments({ outletId });
  if (itemCount > 0) {
    throw ApiError.badRequest("This restaurant still has menu items — delete or move them first");
  }
  const outlet = await FoodOutletModel.findOneAndDelete({ _id: outletId, vendorId });
  if (!outlet) throw ApiError.notFound("Outlet not found");
}

/* ------------------------------ Hours & leaves ------------------------------ */

export async function setOutletWeeklyAvailability(vendorId: string, outletId: string, days: OutletWeeklyDay[]) {
  const outlet = await getOutletForVendor(vendorId, outletId);
  outlet.weeklyAvailability = days;
  await outlet.save();
  return outlet;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function addOutletLeave(
  vendorId: string,
  outletId: string,
  input: { date: Date; type?: "full" | "half"; reason?: string }
) {
  const outlet = await getOutletForVendor(vendorId, outletId);
  outlet.leaves = outlet.leaves.filter((l) => !sameDay(new Date(l.date), new Date(input.date)));
  outlet.leaves.push({ date: input.date, type: input.type ?? "full", reason: input.reason });
  await outlet.save();
  return outlet;
}

export async function removeOutletLeave(vendorId: string, outletId: string, isoDate: string) {
  const outlet = await getOutletForVendor(vendorId, outletId);
  const target = new Date(isoDate);
  outlet.leaves = outlet.leaves.filter((l) => !sameDay(new Date(l.date), target));
  await outlet.save();
  return outlet;
}

/* ------------------------------- Public browse ------------------------------- */

export interface PublicOutletFilters {
  cuisine?: string;
  city?: string;
  kind?: "dining" | "venue";
  page: number;
  limit: number;
}

export async function listPublicOutlets(filters: PublicOutletFilters) {
  const match: FilterQuery<FoodOutletDocument> = { status: "Active" };
  if (filters.cuisine) match.cuisines = new RegExp(`^${escapeRegex(filters.cuisine)}$`, "i");
  if (filters.city) match["location.city"] = new RegExp(`^${escapeRegex(filters.city)}$`, "i");
  if (filters.kind) match.kind = filters.kind;

  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await Promise.all([
    FoodOutletModel.find(match).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
    FoodOutletModel.countDocuments(match),
  ]);
  return { items, total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) };
}

/** Public outlet detail + its in-stock menu, accepting a real id or the URL slug. */
export async function getPublicOutletWithMenu(idOrSlug: string) {
  const query = Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const outlet = await FoodOutletModel.findOne({ ...query, status: "Active" }).lean();
  if (!outlet) throw ApiError.notFound("Restaurant not found");

  const menu = await MenuItemModel.find({ outletId: outlet._id, inStock: true }).sort({ category: 1, name: 1 }).lean();

  // Only surface today-or-future closures to customers.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcomingLeaves = (outlet.leaves ?? []).filter((l) => new Date(l.date) >= todayStart);

  return { outlet: { ...outlet, leaves: upcomingLeaves }, menu };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
