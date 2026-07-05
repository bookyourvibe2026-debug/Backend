import { Request, Response } from "express";
import { Types } from "mongoose";
import { BookingModel } from "../../models/Booking.model";
import { ListingModel } from "../../models/Listing.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  const [listingsCount, activeListingsCount, bookingCounts, earnings] = await Promise.all([
    ListingModel.countDocuments({ vendorId }),
    ListingModel.countDocuments({ vendorId, status: "Active" }),
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid" } },
      { $group: { _id: null, totalEarnings: { $sum: "$vendorEarning" }, totalBookings: { $sum: 1 } } },
    ]),
  ]);

  const bookingsByStatus = Object.fromEntries(bookingCounts.map((c: { _id: string; count: number }) => [c._id, c.count]));

  sendSuccess(res, 200, {
    listingsCount,
    activeListingsCount,
    bookingsByStatus,
    totalEarnings: earnings[0]?.totalEarnings ?? 0,
    settledBookingsCount: earnings[0]?.totalBookings ?? 0,
  });
});

export const getVendorSettledPayments = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await BookingModel.find({ vendorId: req.vendorId, paymentStatus: "paid" })
    .populate("listingId", "title")
    .sort({ updatedAt: -1 })
    .limit(200);

  const settled = bookings.map((b) => ({
    date: b.updatedAt,
    listingName: (b.listingId as unknown as { title?: string })?.title ?? "",
    orderId: b.orderId,
    payment: b.payment,
    totalAmount: b.totalAmount,
    platformFee: b.platformFee,
    yourEarning: b.vendorEarning,
  }));

  sendSuccess(res, 200, settled);
});
