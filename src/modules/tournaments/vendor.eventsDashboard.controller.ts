import { Request, Response } from "express";
import { Types } from "mongoose";
import * as xlsx from "xlsx";
import { TournamentModel } from "../../models/Tournament.model";
import { BookingModel } from "../../models/Booking.model";
import { ListingModel } from "../../models/Listing.model";
import { checkInBooking } from "../../services/booking.service";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

const DAY_MS = 24 * 60 * 60 * 1000;

export const getVendorEventsDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const chartFrom = new Date(startOfToday.getTime() - 13 * DAY_MS); // last 14 days incl. today

  const [
    tournamentsByStatus,
    upcomingEventCount,
    bookingRevenue,
    totalBookingCount,
    checkedInCount,
    activeEventCount,
    chartRaw,
    recentBookingsRaw,
  ] = await Promise.all([
    TournamentModel.aggregate([
      { $match: { vendorId: vendorObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ListingModel.countDocuments({
      vendorId: vendorObjectId,
      type: "Event",
      availableFrom: { $gte: startOfToday },
    }),
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    BookingModel.countDocuments({ vendorId: vendorObjectId }),
    BookingModel.countDocuments({ vendorId: vendorObjectId, checkedIn: true }),
    ListingModel.countDocuments({ vendorId: vendorObjectId, type: "Event", status: "Active" }),
    BookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: chartFrom } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalAmount", 0] } },
          bookings: { $sum: 1 },
        },
      },
    ]),
    BookingModel.find({ vendorId: vendorObjectId })
      .populate("listingId", "title")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // Build a dense 14-day series so the chart always has an entry per day.
  const chartMap = new Map<string, { revenue: number; bookings: number }>(
    chartRaw.map((c: { _id: string; revenue: number; bookings: number }) => [
      c._id,
      { revenue: c.revenue, bookings: c.bookings },
    ])
  );
  const chart = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(chartFrom.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    const entry = chartMap.get(key) ?? { revenue: 0, bookings: 0 };
    return {
      date: key,
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      revenue: entry.revenue,
      bookings: entry.bookings,
    };
  });

  const recentBookings = recentBookingsRaw.map((b: any) => ({
    customerName: b.customerName,
    listingTitle: b.listingId?.title || "Event",
    totalAmount: b.totalAmount,
    status: b.status,
    paymentStatus: b.paymentStatus,
    createdAt: b.createdAt,
  }));

  sendSuccess(res, 200, {
    tournamentsByStatus: Object.fromEntries(
      tournamentsByStatus.map((c: { _id: string; count: number }) => [c._id, c.count])
    ),
    // kept for backward compatibility with the old dashboard shape
    upcomingTournamentCount: upcomingEventCount,
    upcomingEventCount,
    totalRevenue: bookingRevenue[0]?.totalRevenue ?? 0,
    bookingCount: bookingRevenue[0]?.count ?? 0,
    registrationCount: totalBookingCount,
    checkedInCount,
    activeEventCount,
    chart,
    recentBookings,
  });
});

/** Recent event bookings for the dashboard panel, with optional date/status filters. */
export const getVendorEventBookings = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const { startDate, endDate, status, paymentStatus } = req.query as {
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentStatus?: string;
  };

  const filter: Record<string, any> = { vendorId };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00`);
    if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999`);
  }
  if (status && status !== "All") filter.status = status;
  if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;

  const bookings = await BookingModel.find(filter)
    .populate("listingId", "title")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const items = bookings.map((b: any) => ({
    orderId: b.orderId,
    customerName: b.customerName,
    listingTitle: b.listingId?.title || "Event",
    totalAmount: b.totalAmount,
    status: b.status,
    paymentStatus: b.paymentStatus,
    createdAt: b.createdAt,
  }));

  sendSuccess(res, 200, { items });
});

/**
 * Scans a ticket QR (order id) and marks the attendee as arrived. Rejects tickets that
 * don't belong to this vendor (fake / unknown QR → 404) or were cancelled. Re-scanning an
 * already-arrived ticket is reported back so the UI can warn instead of double-counting.
 */
export const checkInEventBooking = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const orderId = req.params.orderId!;

  const { booking, alreadyCheckedIn } = await checkInBooking(orderId, vendorId);
  await booking.populate("listingId", "title");

  sendSuccess(res, 200, {
    alreadyCheckedIn,
    booking: {
      orderId: booking.orderId,
      customerName: booking.customerName,
      listingTitle: (booking.listingId as any)?.title || "Event",
      checkedInAt: booking.checkedInAt,
    },
  });
});

/** The list of attendees who have already been scanned in (most recent first). */
export const getVendorEventArrivals = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const limit = Math.min(Number(req.query.limit) || 100, 200);

  const bookings = await BookingModel.find({ vendorId, checkedIn: true })
    .populate("listingId", "title")
    .sort({ checkedInAt: -1 })
    .limit(limit)
    .lean();

  const items = bookings.map((b: any) => ({
    orderId: b.orderId,
    customerName: b.customerName,
    listingTitle: b.listingId?.title || "Event",
    totalAmount: b.totalAmount,
    checkedInAt: b.checkedInAt,
  }));

  sendSuccess(res, 200, { items });
});

/** Excel export of event bookings, optionally filtered by a createdAt date range. */
export const exportVendorEventBookings = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  const filter: Record<string, any> = { vendorId };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00`);
    if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999`);
  }

  const bookings = await BookingModel.find(filter)
    .populate("listingId", "title")
    .sort({ createdAt: -1 })
    .lean();

  const data = bookings.map((b: any) => ({
    "Customer Name": b.customerName,
    "Phone": b.phone,
    "Event": b.listingId?.title || "N/A",
    "Amount Paid (₹)": b.totalAmount,
    "Event Date": new Date(b.dateTime).toLocaleDateString("en-IN"),
    "Booked On": new Date(b.createdAt).toLocaleDateString("en-IN"),
    "Booking Type": b.payment === "Cash (Offline)" ? "Offline" : "Online",
    "Status": b.status,
    "Payment Status": b.paymentStatus,
  }));

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Event Bookings");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", 'attachment; filename="event_bookings_report.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});
