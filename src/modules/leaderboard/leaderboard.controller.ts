import { Request, Response } from "express";
import { BookingModel } from "../../models/Booking.model";
import { CustomerModel } from "../../models/Customer.model";
import { ListingModel } from "../../models/Listing.model";

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

    // Pipeline to aggregate completed/confirmed bookings per player
    const matchStage: any = {
      status: { $nin: ["Cancelled"] },
      paymentStatus: { $ne: "failed" },
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
        },
      },
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

    let items = bookingResults.map((item, index) => {
      const c = item.customerDoc;
      const name = c?.name || item.customerName || "Anonymous Player";
      const username = c?.username ? (c.username.startsWith("@") ? c.username : `@${c.username}`) : undefined;
      const profileImage = c?.avatarUrl || null;
      const city = c?.city || "Udaipur";
      const areaName = c?.area || (item.listingAddresses?.[0]?.split(",")?.[0]?.trim()) || "Fatehpura";

      return {
        playerId: String(item.customerId || item._id),
        name,
        username,
        profileImage,
        city,
        area: areaName,
        areas: [areaName, city].filter(Boolean),
        completedBookings: item.completedBookings || 1,
        rank: index + 1,
        lastBookingDate: item.lastCompletedBookingAt,
      };
    });

    // Supplement with active registered customers if total booked players is small
    if (items.length < limit) {
      const existingIds = new Set(items.map((i) => i.playerId));
      const registeredCustomers = await CustomerModel.find({ status: "active" })
        .sort({ createdAt: -1 })
        .limit(limit - items.length)
        .lean();

      for (const cust of registeredCustomers) {
        const idStr = String(cust._id);
        if (existingIds.has(idStr)) continue;
        existingIds.add(idStr);

        items.push({
          playerId: idStr,
          name: cust.name || "BYV Player",
          username: cust.username ? (cust.username.startsWith("@") ? cust.username : `@${cust.username}`) : undefined,
          profileImage: cust.avatarUrl || null,
          city: cust.city || "Udaipur",
          area: cust.area || "Fatehpura",
          areas: [cust.area || "Fatehpura", "Udaipur"].filter(Boolean),
          completedBookings: 1,
          rank: items.length + 1,
          lastBookingDate: cust.createdAt?.toISOString(),
        });
      }
    }

    // Re-rank 1..N
    items = items.map((it, idx) => ({ ...it, rank: idx + 1 }));

    res.json({
      success: true,
      items,
      areas: areasList,
      count: items.length,
    });
  } catch (error: any) {
    console.error("[LeaderboardController] Error fetching player leaderboard:", error);
    res.status(500).json({ success: false, error: "Failed to load player leaderboard" });
  }
}
