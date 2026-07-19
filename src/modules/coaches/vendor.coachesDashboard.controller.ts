import { Request, Response } from "express";
import { Types } from "mongoose";
import { CoachModel } from "../../models/Coach.model";
import { CoachSubscriptionModel } from "../../models/CoachSubscription.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorCoachesDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  // 14-day enrolment window for the trend chart.
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [coaches, subsByStatus, earnings, trend, recent] = await Promise.all([
    CoachModel.find({ vendorId }).select("status batches").lean(),
    CoachSubscriptionModel.aggregate([
      { $match: { vendorId: vendorObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    CoachSubscriptionModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid" } },
      { $group: { _id: null, totalEarnings: { $sum: "$amount" }, subscriptionCount: { $sum: 1 } } },
    ]),
    CoachSubscriptionModel.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          enrolments: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amount", 0] } },
        },
      },
    ]),
    CoachSubscriptionModel.find({ vendorId })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("orderId customerName batchName plan amount paymentStatus status createdAt")
      .lean(),
  ]);

  const activeCoachCount = coaches.filter((c) => c.status === "Active").length;
  const batchCount = coaches.reduce((sum, c) => sum + (c.batches?.length ?? 0), 0);

  // Fill the 14-day series so the chart always has a full window.
  const trendMap = new Map(trend.map((t: { _id: string; enrolments: number; revenue: number }) => [t._id, t]));
  const chart: { date: string; label: string; enrolments: number; revenue: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = trendMap.get(key);
    chart.push({
      date: key,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      enrolments: row?.enrolments ?? 0,
      revenue: row?.revenue ?? 0,
    });
  }

  sendSuccess(res, 200, {
    activeCoachCount,
    coachCount: coaches.length,
    batchCount,
    subscriptionsByStatus: Object.fromEntries(
      subsByStatus.map((c: { _id: string; count: number }) => [c._id, c.count])
    ),
    totalEarnings: earnings[0]?.totalEarnings ?? 0,
    subscriptionCount: earnings[0]?.subscriptionCount ?? 0,
    chart,
    recentSubscriptions: recent,
  });
});
