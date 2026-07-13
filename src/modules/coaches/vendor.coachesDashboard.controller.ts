import { Request, Response } from "express";
import { Types } from "mongoose";
import { CoachModel } from "../../models/Coach.model";
import { CoachBookingModel } from "../../models/CoachBooking.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorCoachesDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  const [activeCoachCount, bookingsByStatus, earnings] = await Promise.all([
    CoachModel.countDocuments({ vendorId, status: "Active" }),
    CoachBookingModel.aggregate([
      { $match: { vendorId: vendorObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    CoachBookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid" } },
      { $group: { _id: null, totalEarnings: { $sum: "$amount" }, bookingCount: { $sum: 1 } } },
    ]),
  ]);

  sendSuccess(res, 200, {
    activeCoachCount,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map((c: { _id: string; count: number }) => [c._id, c.count])),
    totalEarnings: earnings[0]?.totalEarnings ?? 0,
    bookingCount: earnings[0]?.bookingCount ?? 0,
  });
});
