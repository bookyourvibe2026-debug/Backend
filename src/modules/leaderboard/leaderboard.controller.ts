import { Request, Response } from "express";
import { BookingModel } from "../../models/Booking.model";
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

interface RankedPlayerItem {
  playerId: string;
  name: string;
  username?: string;
  profileImage: string | null;
  city: string;
  area: string;
  areas: string[];
  sports: string[];
  completedBookings: number;
  rank: number;
  lastBookingDate?: string;
}

export async function getTopPlayersLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const area = parseAreaQuery(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    const [ranking, areasList] = await Promise.all([getCachedRanking(area), getCachedAreasList()]);
    const items = ranking.slice(0, limit);

    sendSuccess(res, 200, { items, areas: areasList, count: items.length });
  } catch (error: any) {
    console.error("[LeaderboardController] Error fetching player leaderboard:", error);
    res.status(500).json({ success: false, error: "Failed to load player leaderboard" });
  }
}

/** The logged-in player's own rank — lets the UI show "You're #47" when they fall outside the visible top-N list. */
export async function getMyPlayerRank(req: Request, res: Response): Promise<void> {
  try {
    const customerId = req.auth?.sub;
    if (!customerId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const area = parseAreaQuery(req);
    const ranking = await getCachedRanking(area);
    const mine = ranking.find((item) => item.playerId === String(customerId));

    sendSuccess(res, 200, {
      rank: mine?.rank ?? null,
      completedBookings: mine?.completedBookings ?? 0,
      totalPlayers: ranking.length,
    });
  } catch (error: any) {
    console.error("[LeaderboardController] Error fetching player rank:", error);
    res.status(500).json({ success: false, error: "Failed to load player rank" });
  }
}

function parseAreaQuery(req: Request): string | undefined {
  return typeof req.query.area === "string" && !req.query.area.toLowerCase().includes("all")
    ? req.query.area.trim()
    : undefined;
}

function getCachedRanking(area: string | undefined): Promise<RankedPlayerItem[]> {
  const cacheKey = `${LEADERBOARD_CACHE_PREFIX}ranking:${JSON.stringify({ area })}`;
  return cached(cacheKey, LEADERBOARD_CACHE_TTL_MS, () => computeFullRanking(area));
}

function getCachedAreasList(): Promise<string[]> {
  return cached(`${LEADERBOARD_CACHE_PREFIX}areas`, LEADERBOARD_CACHE_TTL_MS, computeAreasList);
}

async function computeAreasList(): Promise<string[]> {
  // Fetch distinct listing areas to keep the frontend dropdown options accurate
  const dbAreas = await ListingModel.distinct("address");
  const parsedAreas = new Set<string>(["All areas", ...DEFAULT_AREAS]);
  for (const raw of dbAreas) {
    if (typeof raw === "string" && raw.trim()) {
      const parts = raw.split(",").map((p) => p.trim());
      if (parts[0]) parsedAreas.add(parts[0]);
    }
  }
  return Array.from(parsedAreas);
}

/** Full sorted ranking (no cap) so the top-N list and an individual player's rank always agree on the same ordering. */
async function computeFullRanking(area: string | undefined): Promise<RankedPlayerItem[]> {
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

  return bookingResults.map((item, index) => {
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
}
