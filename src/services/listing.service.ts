import { FilterQuery } from "mongoose";
import { ListingDocument, ListingModel } from "../models/Listing.model";
import { ApiError } from "../utils/ApiError";

export interface ListingQuery {
  city?: string;
  category?: string;
  type?: string;
  search?: string;
  page: number;
  limit: number;
}

export async function findPublicListings(query: ListingQuery) {
  const filter: FilterQuery<ListingDocument> = { status: "Active", isPrivate: false };
  if (query.city) filter.city = new RegExp(`^${escapeRegex(query.city)}$`, "i");
  if (query.category) filter.category = query.category;
  if (query.type) filter.type = query.type;
  if (query.search) filter.$text = { $search: query.search };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    ListingModel.find(filter).sort({ trending: -1, createdAt: -1 }).skip(skip).limit(query.limit),
    ListingModel.countDocuments(filter),
  ]);

  return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
}

export async function findPublicListingById(id: string) {
  const listing = await ListingModel.findOne({ _id: id, status: "Active", isPrivate: false });
  if (!listing) throw ApiError.notFound("Listing not found");
  return listing;
}

export async function createListingForVendor(vendorId: string, ownerName: string | undefined, data: Partial<ListingDocument>) {
  return ListingModel.create({ ...data, vendorId, ownerName, access: "Vendor Owned" });
}

export async function createListingForAdmin(data: Partial<ListingDocument>) {
  return ListingModel.create({ ...data, vendorId: data.vendorId ?? null, access: data.access ?? "Claimed from Admin" });
}

export async function listVendorListings(vendorId: string, query: Partial<ListingQuery>) {
  const filter: FilterQuery<ListingDocument> = { vendorId };
  if (query.type) filter.type = query.type;
  if (query.search) filter.$text = { $search: query.search };
  return ListingModel.find(filter).sort({ createdAt: -1 });
}

export async function listAdminListings(query: Partial<ListingQuery>) {
  const filter: FilterQuery<ListingDocument> = {};
  if (query.city) filter.city = query.city;
  if (query.type) filter.type = query.type;
  if (query.search) filter.$text = { $search: query.search };
  return ListingModel.find(filter).sort({ createdAt: -1 });
}

export async function getListingScopedToVendor(id: string, vendorId: string) {
  const listing = await ListingModel.findOne({ _id: id, vendorId });
  if (!listing) throw ApiError.notFound("Listing not found");
  return listing;
}

export async function getListingById(id: string) {
  const listing = await ListingModel.findById(id);
  if (!listing) throw ApiError.notFound("Listing not found");
  return listing;
}

export async function updateListingScopedToVendor(id: string, vendorId: string, data: Partial<ListingDocument>) {
  const listing = await getListingScopedToVendor(id, vendorId);
  listing.set(data);
  await listing.save();
  return listing;
}

export async function updateListingAsAdmin(id: string, data: Partial<ListingDocument>) {
  const listing = await getListingById(id);
  listing.set(data);
  await listing.save();
  return listing;
}

export async function deleteListingScopedToVendor(id: string, vendorId: string) {
  const listing = await ListingModel.findOneAndDelete({ _id: id, vendorId });
  if (!listing) throw ApiError.notFound("Listing not found");
}

export async function deleteListingAsAdmin(id: string) {
  const listing = await ListingModel.findByIdAndDelete(id);
  if (!listing) throw ApiError.notFound("Listing not found");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
