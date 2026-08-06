import { Request, Response } from "express";
import { BookingModel } from "../../models/Booking.model";
import { CustomerModel } from "../../models/Customer.model";
import { ListingModel } from "../../models/Listing.model";
import { cached } from "../../utils/cache";
import { sendSuccess } from "../../utils/ApiResponse";

const LEADERBOARD_CACHE_PREFIX = "leaderboard:top-players:";
const LEADERBOARD_CACHE_TTL_MS = 30_000; // matches the public-listing cache TTL

const DEFAULT_AREAS = [
  "All areas",
  "Fatehpura",
  "Sukher",
  "Hiran Magri",
  "Panchwati",
  "Shobhagpura",
  "Bhuwana",
  "Madri",
];

export async function getTopPlayersLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const area = typeof req.query.area === "string" && !req.query.area.toLowerCase().includes("all") ? req.query.area.trim() : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    const cacheKey = `${LEADERBOARD_CACHE_PREFIX}${JSON.stringify({ area, limit })}`;
    const payload = await cached(cacheKey, LEADERBOARD_CACHE_TTL_MS, () => computeLeaderboard(area, limit));

    sendSuccess(res, 200, payload);
  } catch (error: any) {
    console.error("[LeaderboardController] Error fetching player leaderboard:", error);
    res.status(500).json({ success: false, error: "Failed to load player leaderboard" });
  }
}

async function computeLeaderboard(area: string | undefined, limit: number) {
  // Fetch distinct listing areas to keep the frontend dropdown options accurate
  const dbAreas = await ListingModel.distinct("address");
  const parsedAreas = new Set<string>(["All areas", ...DEFAULT_AREAS]);
  for (const raw of dbAreas) {
    if (typeof raw === "string" && raw.trim()) {
      const parts = raw.split(",").map((p) => p.trim());
      if (parts[0]) parsedAreas.add(parts[0]);
    }
  }
  const areasList = Array.from(parsedAreas);

  // Only count genuinely confirmed / completed & paid bookings
  const matchStage: any = {
    status: { $in: ["Confirmed", "Part Paid", "Completed"] },
    paymentStatus: "paid",
  };

  const pipeline: any[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: "listings",
        localField: "listingId",
        foreignField: "_id",
        as: "listing",
      },
    },
    { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
  ];

  if (area) {
    pipeline.push({
      $match: {
        $or: [
          { "listing.address": { $regex: new RegExp(area, "i") } },
          { "listing.city": { $regex: new RegExp(area, "i") } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: { $ifNull: ["$customerId", "$phone", "$customerName"] },
        customerId: { $first: "$customerId" },
        customerName: { $first: "$customerName" },
        phone: { $first: "$phone" },
        completedBookings: { $sum: 1 },
        lastCompletedBookingAt: { $max: "$createdAt" },
        listingAddresses: { $addToSet: "$listing.address" },
        sportsPlayed: { $addToSet: "$sport" },
      },
    },
    // Only include players who have at least 1 real booking
    { $match: { completedBookings: { $gte: 1 } } },
    {
      $sort: {
        completedBookings: -1,
        lastCompletedBookingAt: -1,
      },
    },
    { $limit: limit },
    {
      $lookup: {
        from: "customers",
        localField: "customerId",
        foreignField: "_id",
        as: "customerDoc",
      },
    },
    { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } }
  );

  const bookingResults = await BookingModel.aggregate(pipeline);

  const items = bookingResults.map((item, index) => {
    const c = item.customerDoc;
    const name = c?.name || item.customerName || "Anonymous Player";
    const username = c?.username ? (c.username.startsWith("@") ? c.username : `@${c.username}`) : undefined;
    const profileImage = c?.avatarUrl || null;
    const city = c?.city || "Udaipur";
    const areaName = c?.area || (item.listingAddresses?.[0]?.split(",")?.[0]?.trim()) || "Fatehpura";
    const sports = item.sportsPlayed?.filter(Boolean) ?? [];

    return {
      playerId: String(item.customerId || item._id),
      name,
      username,
      profileImage,
      city,
      area: areaName,
      areas: [areaName, city].filter(Boolean),
      sports,
      completedBookings: item.completedBookings,
      rank: index + 1,
      lastBookingDate: item.lastCompletedBookingAt,
    };
  });

  return { items, areas: areasList, count: items.length };
}
