import { Request, Response } from "express";
import { Types } from "mongoose";
import { FoodOrderModel } from "../../models/FoodOrder.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

const PERIOD_MS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export const getVendorFoodDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);
  const requestedPeriod = typeof req.query.period === "string" ? req.query.period : "day";
  const period = requestedPeriod in PERIOD_MS ? requestedPeriod : "day";
  const since = new Date(Date.now() - PERIOD_MS[period]!);

  // 14-day window for the trend chart (independent of the selected period).
  const trendSince = new Date();
  trendSince.setDate(trendSince.getDate() - 13);
  trendSince.setHours(0, 0, 0, 0);

  const [statusCounts, revenue, allTimeOrders, trend, recent] = await Promise.all([
    FoodOrderModel.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    FoodOrderModel.aggregate([
      { $match: { vendorId: vendorObjectId, status: "Delivered", createdAt: { $gte: since } } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
    ]),
    FoodOrderModel.countDocuments({ vendorId }),
    FoodOrderModel.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: trendSince } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, "$totalAmount", 0] } },
        },
      },
    ]),
    FoodOrderModel.find({ vendorId })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("orderId customerName items totalAmount status createdAt")
      .lean(),
  ]);

  // Fill the 14-day series so the chart always has a full window.
  const trendMap = new Map(trend.map((t: { _id: string; orders: number; revenue: number }) => [t._id, t]));
  const chart: { date: string; label: string; orders: number; revenue: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(trendSince);
    d.setDate(trendSince.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = trendMap.get(key);
    chart.push({
      date: key,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      orders: row?.orders ?? 0,
      revenue: row?.revenue ?? 0,
    });
  }

  sendSuccess(res, 200, {
    period,
    ordersByStatus: Object.fromEntries(statusCounts.map((c: { _id: string; count: number }) => [c._id, c.count])),
    totalRevenue: revenue[0]?.totalRevenue ?? 0,
    deliveredOrderCount: revenue[0]?.orderCount ?? 0,
    allTimeOrderCount: allTimeOrders,
    chart,
    recentOrders: recent,
  });
});
