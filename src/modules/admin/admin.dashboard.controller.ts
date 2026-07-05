import { Request, Response } from "express";
import mongoose from "mongoose";
import { BookingModel } from "../../models/Booking.model";
import { CustomerModel } from "../../models/Customer.model";
import { ListingModel } from "../../models/Listing.model";
import { VendorModel } from "../../models/Vendor.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

async function growthStats<T>(model: mongoose.Model<T>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [total, last30Days] = await Promise.all([
    model.countDocuments(),
    model.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
  ]);
  const previousTotal = total - last30Days;
  const growthPercent = previousTotal > 0 ? Math.round((last30Days / previousTotal) * 1000) / 10 : last30Days > 0 ? 100 : 0;
  return { total, last30Days, growthPercent };
}

export const getAdminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const [
    vendorsByStatus,
    bookingsByStatus,
    revenue,
    listingsByState,
    topCities,
    recentBookings,
    listings,
    bookings,
    customers,
  ] = await Promise.all([
    VendorModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    BookingModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    BookingModel.aggregate([
      { $match: { paymentStatus: "paid" } },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$totalAmount" },
          totalPlatformFee: { $sum: "$platformFee" },
          totalVendorEarnings: { $sum: "$vendorEarning" },
        },
      },
    ]),
    ListingModel.aggregate([{ $group: { _id: "$state", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ListingModel.aggregate([
      { $group: { _id: { city: "$city", state: "$state" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    BookingModel.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("listingId", "title")
      .select("orderId customerName status dateTime listingId"),
    growthStats(ListingModel),
    growthStats(BookingModel),
    growthStats(CustomerModel),
  ]);

  sendSuccess(res, 200, {
    listingsCount: listings.total,
    listingsGrowthPercent: listings.growthPercent,
    bookingsCount: bookings.total,
    bookingsGrowthPercent: bookings.growthPercent,
    newUsers: customers.last30Days,
    usersGrowthPercent: customers.growthPercent,
    vendorsByStatus: Object.fromEntries(vendorsByStatus.map((v: { _id: string; count: number }) => [v._id, v.count])),
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b: { _id: string; count: number }) => [b._id, b.count])),
    revenue: revenue[0] ?? { totalCollected: 0, totalPlatformFee: 0, totalVendorEarnings: 0 },
    listingsByState: listingsByState.map((s: { _id: string; count: number }) => ({ state: s._id, count: s.count })),
    topCities: topCities.map((c: { _id: { city: string; state: string }; count: number }) => ({
      city: c._id.city,
      state: c._id.state,
      count: c.count,
    })),
    recentBookings: recentBookings.map((b) => {
      const listing = b.listingId as unknown as { title?: string } | null;
      return {
        orderId: b.orderId,
        listingName: listing?.title ?? "Deleted listing",
        customerName: b.customerName,
        status: b.status,
        dateTime: b.dateTime,
      };
    }),
  });
});

export const getSystemHealth = asyncHandler(async (_req: Request, res: Response) => {
  const dbStateNames = ["disconnected", "connected", "connecting", "disconnecting"];
  sendSuccess(res, 200, {
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
    database: {
      state: dbStateNames[mongoose.connection.readyState] ?? "unknown",
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});
