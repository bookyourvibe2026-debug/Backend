import { Request, Response } from "express";
import { Types } from "mongoose";
import { BookingModel } from "../../models/Booking.model";
import { ListingModel } from "../../models/Listing.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const getVendorDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  const { startDate, endDate, compareWith, listingId, sport } = req.query as {
    startDate?: string; endDate?: string; compareWith?: string; listingId?: string; sport?: string;
  };

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

  // Financial report + revenue trend + court status — all computed from real paid
  // bookings, keyed on the slot time (dateTime) in IST so weekday/weekend splits
  // match what the vendor sees on their calendar.
  const TZ = "Asia/Kolkata";
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const trendStart = new Date(todayStart); trendStart.setDate(trendStart.getDate() - 6);

  const paidFinancialMatch: Record<string, unknown> = { vendorId: vendorObjectId, paymentStatus: "paid" };
  if (listingId && Types.ObjectId.isValid(listingId)) {
    paidFinancialMatch.listingId = Types.ObjectId.createFromHexString(listingId);
  }
  if (sport) paidFinancialMatch.sport = sport;

  const periodGroup = [{ $group: { _id: null, bookings: { $sum: 1 }, avgRate: { $avg: "$totalAmount" } } }];

  const [
    listingsCount,
    activeListingsCount,
    currentBookings,
    currentEarnings,
    currentCustomers,
    prevBookings,
    prevEarnings,
    prevCustomers,
    financialFacets,
    revenueByDay,
    courtStatusRaw,
    peakHourRaw
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
    // Financial report: one YTD scan faceted into the table's periods.
    BookingModel.aggregate([
      { $match: { ...paidFinancialMatch, dateTime: { $gte: ytdStart, $lte: todayEnd } } },
      {
        $facet: {
          today: [{ $match: { dateTime: { $gte: todayStart } } }, ...periodGroup],
          weekdays: [{ $match: { $expr: { $in: [{ $isoDayOfWeek: { date: "$dateTime", timezone: TZ } }, [1, 2, 3, 4]] } } }, ...periodGroup],
          weekend: [{ $match: { $expr: { $in: [{ $isoDayOfWeek: { date: "$dateTime", timezone: TZ } }, [5, 6, 7]] } } }, ...periodGroup],
          thisMonth: [{ $match: { dateTime: { $gte: monthStart } } }, ...periodGroup],
          totalYtd: [...periodGroup],
        },
      },
    ]),
    // Revenue trend: vendor earnings per day for the last 7 days.
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid", dateTime: { $gte: trendStart, $lte: todayEnd } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$dateTime", timezone: TZ } }, earnings: { $sum: "$vendorEarning" }, bookings: { $sum: 1 } } },
    ]),
    // Court status: paid bookings per listing in the selected period.
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid", dateTime: { $gte: currentStart, $lte: currentEnd } } },
      { $group: { _id: "$listingId", bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 3 },
      { $lookup: { from: "listings", localField: "_id", foreignField: "_id", as: "listing" } },
      { $project: { bookings: 1, title: { $ifNull: [{ $arrayElemAt: ["$listing.title", 0] }, "Court"] } } },
    ]),
    // Peak hour: the slot hour with the most paid bookings today.
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid", dateTime: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: { $hour: { date: "$dateTime", timezone: TZ } }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 },
    ]),
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

  type PeriodStat = { bookings: number; avgRate: number };
  const facet = (financialFacets[0] ?? {}) as Record<string, Array<{ bookings: number; avgRate: number | null }>>;
  const periodStat = (key: string): PeriodStat => {
    const row = facet[key]?.[0];
    return { bookings: row?.bookings ?? 0, avgRate: Math.round(row?.avgRate ?? 0) };
  };
  const financialReport = {
    today: periodStat("today"),
    weekdays: periodStat("weekdays"),
    weekend: periodStat("weekend"),
    thisMonth: periodStat("thisMonth"),
    totalYtd: periodStat("totalYtd"),
  };

  const earningsByDate = new Map(revenueByDay.map((r: { _id: string; earnings: number; bookings: number }) => [r._id, r]));
  const revenueTrend: Array<{ date: string; earnings: number; bookings: number }> = [];
  for (let i = 6; i >= 0; i--) {
    // en-CA formats as YYYY-MM-DD, matching the $dateToString keys above (both IST).
    const key = new Date(now.getTime() - i * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
    const row = earningsByDate.get(key);
    revenueTrend.push({ date: key, earnings: row?.earnings ?? 0, bookings: row?.bookings ?? 0 });
  }

  const courtStatus = courtStatusRaw.map((c: { _id: Types.ObjectId; title: string; bookings: number }) => ({
    listingId: c._id,
    title: c.title,
    bookings: c.bookings,
  }));

  const peakHour = peakHourRaw[0] as { _id: number; count: number } | undefined;
  const peakHourToday = peakHour ? `${String(peakHour._id).padStart(2, "0")}:00 - ${String((peakHour._id + 1) % 24).padStart(2, "0")}:00` : null;
  const bookingsToday = revenueTrend[6]?.bookings ?? 0;

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
    financialReport,
    revenueTrend,
    courtStatus,
    peakHourToday,
    bookingsToday,
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
