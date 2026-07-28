import { FilterQuery, Types } from "mongoose";
import { ListingDocument, ListingModel } from "../models/Listing.model";
import { BookingModel } from "../models/Booking.model";
import { VendorModel } from "../models/Vendor.model";
import { ApiError } from "../utils/ApiError";
import { cached, invalidatePrefix } from "../utils/cache";

/** Namespace + TTL for cached public reads. Any listing write clears this prefix. */
const PUBLIC_CACHE_PREFIX = "listings:public:";
const PUBLIC_CACHE_TTL_MS = 30_000; // 30s — fresh enough for browsing, big win for repeat traffic

/** Drop all cached public listing responses. Call after any create/update/delete. */
export function invalidatePublicListingCache(): void {
  invalidatePrefix(PUBLIC_CACHE_PREFIX);
}

export interface ListingQuery {
  city?: string;
  category?: string;
  subCategory?: string;
  type?: string;
  vendorId?: string;
  search?: string;
  page: number;
  limit: number;
}

export async function findPublicListings(query: ListingQuery) {
  const cacheKey = `${PUBLIC_CACHE_PREFIX}list:${JSON.stringify({
    city: query.city ?? "",
    category: query.category ?? "",
    subCategory: query.subCategory ?? "",
    type: query.type ?? "",
    vendorId: query.vendorId ?? "",
    search: query.search ?? "",
    page: query.page,
    limit: query.limit,
  })}`;

  return cached(cacheKey, PUBLIC_CACHE_TTL_MS, async () => {
    const filter: FilterQuery<ListingDocument> = { status: "Active", isPrivate: false };
    if (query.city) filter.city = new RegExp(`^${escapeRegex(query.city)}$`, "i");
    if (query.category) filter.categories = query.category;
    if (query.subCategory) filter.subCategories = query.subCategory;
    if (query.type) filter.type = query.type;
    if (query.vendorId) filter.vendorId = query.vendorId;
    if (query.search) filter.$text = { $search: query.search };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      ListingModel.find(filter).sort({ trending: -1, createdAt: -1 }).skip(skip).limit(query.limit),
      ListingModel.countDocuments(filter),
    ]);

    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
  });
}

export async function findPublicListingById(id: string) {
  return cached(`${PUBLIC_CACHE_PREFIX}byId:${id}`, PUBLIC_CACHE_TTL_MS, async () => {
    const query = Types.ObjectId.isValid(id) ? { _id: id } : { slug: id.toLowerCase() };
    const listing = await ListingModel.findOne({ ...query, status: "Active", isPrivate: false });
    if (!listing) throw ApiError.notFound("Listing not found");

    if (listing.type === "Event" && listing.capacity) {
      const taken = await BookingModel.countDocuments({ listingId: listing._id, status: { $ne: "Cancelled" } });
      return { ...listing.toObject(), spotsLeft: Math.max(listing.capacity - taken, 0) };
    }

    return listing;
  });
}

/* ── City rankings ──
 * "BYV Udaipur Ranking": the venues in a city taking the most bookings, so players
 * can see where the city actually plays. Ranked on confirmed booking volume, not on
 * anything a vendor can set themselves. */

export interface RankingQuery {
  city: string;
  /** Locality inside the city — one of the `areas` values returned alongside the rows. */
  area?: string;
  limit: number;
  /** Only count bookings from the last N days. 0/absent = all time. */
  days?: number;
}

export interface RankedVenue {
  rank: number;
  listingId: string;
  slug?: string;
  title: string;
  city: string;
  area: string;
  address: string;
  image: string;
  price: number;
  categories: string[];
  tags: string[];
  bookings: number;
}

/**
 * The locality a venue sits in, pulled out of its address. Addresses come from
 * Nominatim as "Venue, Road, Locality, City, District, State, PIN, Country", so the
 * segment just before the city is the locality; we fall back to the second segment
 * (and finally to the city) when the address doesn't follow that shape.
 */
export function areaFromAddress(address: string | undefined, city: string): string {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 1 && !/^\d[\d\s-]*$/.test(p)); // drop PIN codes / house numbers
  if (parts.length === 0) return city;

  const cityIndex = parts.findIndex((p) => p.toLowerCase() === city.toLowerCase());
  if (cityIndex > 0) return parts[cityIndex - 1]!;
  if (parts.length > 1) return parts[1]!;
  return parts[0] ?? city;
}

export async function findVenueRankings(query: RankingQuery) {
  const cacheKey = `${PUBLIC_CACHE_PREFIX}rank:${JSON.stringify({
    city: query.city,
    area: query.area ?? "",
    limit: query.limit,
    days: query.days ?? 0,
  })}`;

  return cached(cacheKey, PUBLIC_CACHE_TTL_MS, async () => {
    const listings = await ListingModel.find({
      status: "Active",
      isPrivate: false,
      type: { $in: ["Turf", "Game"] },
      city: new RegExp(`^${escapeRegex(query.city)}$`, "i"),
    }).select("title slug city address coverImage images price categories tags");

    // Every area in the city, so the filter offers real choices rather than a guess.
    const areas = Array.from(
      new Set(listings.map((l) => areaFromAddress(l.address, l.city)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const inScope = query.area
      ? listings.filter((l) => areaFromAddress(l.address, l.city).toLowerCase() === query.area!.toLowerCase())
      : listings;

    if (inScope.length === 0) return { items: [] as RankedVenue[], areas, city: query.city };

    const match: Record<string, unknown> = {
      listingId: { $in: inScope.map((l) => l._id) },
      status: { $in: ["Confirmed", "Part Paid", "Completed"] },
    };
    if (query.days && query.days > 0) {
      match.createdAt = { $gte: new Date(Date.now() - query.days * 24 * 60 * 60_000) };
    }

    const counts = await BookingModel.aggregate<{ _id: unknown; bookings: number }>([
      { $match: match },
      { $group: { _id: "$listingId", bookings: { $sum: 1 } } },
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.bookings]));

    const items = inScope
      .map((l) => ({
        listingId: String(l._id),
        slug: l.slug,
        title: l.title,
        city: l.city,
        area: areaFromAddress(l.address, l.city),
        address: l.address,
        image: l.coverImage || l.images?.[0]?.url || "",
        price: l.price,
        categories: l.categories ?? [],
        tags: l.tags ?? [],
        bookings: countById.get(String(l._id)) ?? 0,
      }))
      // Ties break on price so the order is stable between requests.
      .sort((a, b) => b.bookings - a.bookings || a.price - b.price || a.title.localeCompare(b.title))
      .slice(0, query.limit)
      .map((row, index): RankedVenue => ({ rank: index + 1, ...row }));

    return { items, areas, city: query.city };
  });
}

export async function findPublicVendorProfile(vendorId: string) {
  return cached(`${PUBLIC_CACHE_PREFIX}vendor:${vendorId}`, PUBLIC_CACHE_TTL_MS, async () => {
    const vendor = await VendorModel.findOne({ _id: vendorId, status: "approved" }).select(
      "businessName ownerName logo banner poster city state"
    );
    if (!vendor) throw ApiError.notFound("Vendor not found");

    const listings = await ListingModel.find({
      vendorId,
      status: "Active",
      isPrivate: false,
      type: { $in: ["Turf", "Game"] },
    }).sort({ trending: -1, createdAt: -1 });

    return { vendor, listings };
  });
}

export async function createListingForVendor(vendorId: string, ownerName: string | undefined, data: Partial<ListingDocument>) {
  const listing = await ListingModel.create({ ...data, vendorId, ownerName, access: "Vendor Owned" });
  invalidatePublicListingCache();
  return listing;
}

export async function createListingForAdmin(data: Partial<ListingDocument>) {
  const listing = await ListingModel.create({ ...data, vendorId: data.vendorId ?? null, access: data.access ?? "Claimed from Admin" });
  invalidatePublicListingCache();
  return listing;
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
  invalidatePublicListingCache();
  return listing;
}

export async function updateListingAsAdmin(id: string, data: Partial<ListingDocument>) {
  const listing = await getListingById(id);
  listing.set(data);
  await listing.save();
  invalidatePublicListingCache();
  return listing;
}

export async function deleteListingScopedToVendor(id: string, vendorId: string) {
  const listing = await ListingModel.findOneAndDelete({ _id: id, vendorId });
  if (!listing) throw ApiError.notFound("Listing not found");
  invalidatePublicListingCache();
}

export async function deleteListingAsAdmin(id: string) {
  const listing = await ListingModel.findByIdAndDelete(id);
  if (!listing) throw ApiError.notFound("Listing not found");
  invalidatePublicListingCache();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
