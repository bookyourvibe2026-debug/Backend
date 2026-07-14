import { Request, Response } from "express";
import { Types } from "mongoose";
import { BookingModel } from "../../models/Booking.model";
import { ListingModel } from "../../models/Listing.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  const { startDate, endDate, compareWith } = req.query as { startDate?: string; endDate?: string; compareWith?: string };

  const currentStart = startDate ? new Date(startDate) : new Date();
  if (startDate) currentStart.setHours(0, 0, 0, 0);
  else currentStart.setDate(currentStart.getDate() - 7); // Default to last 7 days

  const currentEnd = endDate ? new Date(endDate) : new Date();
  if (endDate) currentEnd.setHours(23, 59, 59, 999);
  else currentEnd.setHours(23, 59, 59, 999);

  let prevStart = new Date(currentStart);
  let prevEnd = new Date(currentEnd);
  
  if (compareWith === "yesterday") {
    prevStart.setDate(prevStart.getDate() - 1);
    prevEnd.setDate(prevEnd.getDate() - 1);
  } else if (compareWith === "last_week") {
    prevStart.setDate(prevStart.getDate() - 7);
    prevEnd.setDate(prevEnd.getDate() - 7);
  } else {
    const diffTime = currentEnd.getTime() - currentStart.getTime();
    prevStart = new Date(currentStart.getTime() - diffTime);
    prevEnd = new Date(currentEnd.getTime() - diffTime);
  }

  const currentMatch = { vendorId: vendorObjectId, createdAt: { $gte: currentStart, $lte: currentEnd } };
  const prevMatch = { vendorId: vendorObjectId, createdAt: { $gte: prevStart, $lte: prevEnd } };

  const [
    listingsCount,
    activeListingsCount,
    currentBookings,
    currentEarnings,
    currentCustomers,
    prevBookings,
    prevEarnings,
    prevCustomers
  ] = await Promise.all([
    ListingModel.countDocuments({ vendorId }),
    ListingModel.countDocuments({ vendorId, status: "Active" }),
    // Current period
    BookingModel.aggregate([
      { $match: currentMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    BookingModel.aggregate([
      { $match: { ...currentMatch, paymentStatus: "paid" } },
      { $group: { _id: null, totalEarnings: { $sum: "$vendorEarning" }, totalBookings: { $sum: 1 } } }
    ]),
    BookingModel.distinct("customerId", currentMatch).then(c => c.length),
    // Previous period
    BookingModel.aggregate([
      { $match: prevMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    BookingModel.aggregate([
      { $match: { ...prevMatch, paymentStatus: "paid" } },
      { $group: { _id: null, totalEarnings: { $sum: "$vendorEarning" }, totalBookings: { $sum: 1 } } }
    ]),
    BookingModel.distinct("customerId", prevMatch).then(c => c.length),
  ]);

  const currTotalEarnings = currentEarnings[0]?.totalEarnings ?? 0;
  const currSettledBookings = currentEarnings[0]?.totalBookings ?? 0;
  const currOccupancy = Math.min(100, currSettledBookings * 4 + 10);
  
  const prevTotalEarnings = prevEarnings[0]?.totalEarnings ?? 0;
  const prevSettledBookings = prevEarnings[0]?.totalBookings ?? 0;
  const prevOccupancy = Math.min(100, prevSettledBookings * 4 + 10);

  const calcTrend = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const bookingsByStatus = Object.fromEntries(currentBookings.map((c: { _id: string; count: number }) => [c._id, c.count]));

  sendSuccess(res, 200, {
    listingsCount,
    activeListingsCount,
    bookingsByStatus,
    totalEarnings: currTotalEarnings,
    earningsTrend: calcTrend(currTotalEarnings, prevTotalEarnings),
    settledBookingsCount: currSettledBookings,
    bookingsTrend: calcTrend(currSettledBookings, prevSettledBookings),
    customersCount: currentCustomers,
    customersTrend: calcTrend(currentCustomers, prevCustomers),
    occupancyRate: currOccupancy,
    occupancyTrend: currOccupancy - prevOccupancy, // direct difference for %
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
