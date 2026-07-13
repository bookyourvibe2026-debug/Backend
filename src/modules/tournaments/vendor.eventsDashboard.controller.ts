import { Request, Response } from "express";
import { Types } from "mongoose";
import { TournamentModel } from "../../models/Tournament.model";
import { TournamentRegistrationModel } from "../../models/TournamentRegistration.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorEventsDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  const [tournamentsByStatus, upcomingCount, revenue] = await Promise.all([
    TournamentModel.aggregate([
      { $match: { vendorId: vendorObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    TournamentModel.countDocuments({ vendorId, status: "Upcoming" }),
    TournamentRegistrationModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" }, registrationCount: { $sum: 1 } } },
    ]),
  ]);

  sendSuccess(res, 200, {
    tournamentsByStatus: Object.fromEntries(
      tournamentsByStatus.map((c: { _id: string; count: number }) => [c._id, c.count])
    ),
    upcomingTournamentCount: upcomingCount,
    totalRevenue: revenue[0]?.totalRevenue ?? 0,
    registrationCount: revenue[0]?.registrationCount ?? 0,
  });
});
