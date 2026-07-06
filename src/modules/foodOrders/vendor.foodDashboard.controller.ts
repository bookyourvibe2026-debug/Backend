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

  const [statusCounts, revenue, allTimeOrders] = await Promise.all([
    FoodOrderModel.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    FoodOrderModel.aggregate([
      { $match: { vendorId: vendorObjectId, status: "Delivered", createdAt: { $gte: since } } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
    ]),
    FoodOrderModel.countDocuments({ vendorId }),
  ]);

  sendSuccess(res, 200, {
    period,
    ordersByStatus: Object.fromEntries(statusCounts.map((c: { _id: string; count: number }) => [c._id, c.count])),
    totalRevenue: revenue[0]?.totalRevenue ?? 0,
    deliveredOrderCount: revenue[0]?.orderCount ?? 0,
    allTimeOrderCount: allTimeOrders,
  });
});
