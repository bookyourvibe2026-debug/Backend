import { Request, Response } from "express";
import { Types } from "mongoose";
import { DiningBillModel } from "../../models/DiningBill.model";
import { TableBookingModel } from "../../models/TableBooking.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { setOutletDineout } from "../../services/foodOutlet.service";
import { listDiningBillsForVendor } from "../../services/diningBill.service";
import {
  checkInTableBooking,
  getTableBooking,
  listTableBookingsForVendor,
  updateTableBookingStatus,
} from "../../services/tableBooking.service";

/* ─── Table bookings ────────────────────────────────────────────── */

export const getVendorTableBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, outletId, scope, date, page, limit } = req.query as unknown as {
    status?: string;
    outletId?: string;
    scope?: "upcoming" | "history";
    date?: string;
    page: number;
    limit: number;
  };
  const result = await listTableBookingsForVendor(req.vendorId!, { status, outletId, scope, date, page, limit });
  sendSuccess(res, 200, result);
});

/** Full booking behind a scanned QR — read-only, so the host can check the party before seating. */
export const getVendorTableBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getTableBooking(req.params.bookingId!, { vendorId: req.vendorId! });
  sendSuccess(res, 200, booking);
});

export const updateVendorTableBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const booking = await updateTableBookingStatus(
    req.params.bookingId!,
    req.body.status,
    req.vendorId!,
    req.body.rejectionReason
  );
  sendSuccess(res, 200, booking, "Booking updated");
});

export const checkInVendorTableBooking = asyncHandler(async (req: Request, res: Response) => {
  const { booking, alreadyCheckedIn } = await checkInTableBooking(req.params.bookingId!, req.vendorId!);
  sendSuccess(res, 200, booking, alreadyCheckedIn ? "Already seated" : "Party seated");
});

/* ─── Dining bills ──────────────────────────────────────────────── */

export const getVendorDiningBills = asyncHandler(async (req: Request, res: Response) => {
  const { outletId, page, limit } = req.query as unknown as { outletId?: string; page: number; limit: number };
  const result = await listDiningBillsForVendor(req.vendorId!, { outletId, page, limit });
  sendSuccess(res, 200, result);
});

/* ─── Dineout settings ──────────────────────────────────────────── */

export const setVendorOutletDineout = asyncHandler(async (req: Request, res: Response) => {
  const outlet = await setOutletDineout(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 200, outlet, "Dineout settings updated");
});

/* ─── Dashboard ─────────────────────────────────────────────────── */

const PERIOD_MS: Record<string, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

/** Reservations and settled-bill revenue for the Dineout board. */
export const getVendorDineoutDashboard = asyncHandler(async (req: Request, res: Response) => {
  const vendorId = req.vendorId!;
  const vendorObjectId = Types.ObjectId.createFromHexString(vendorId);
  const requestedPeriod = typeof req.query.period === "string" ? req.query.period : "day";
  const period = requestedPeriod in PERIOD_MS ? requestedPeriod : "day";
  const since = new Date(Date.now() - PERIOD_MS[period]!);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [bookingsByStatus, billTotals, todayBookings, coversAgg, upcoming, recentBills] = await Promise.all([
    TableBookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, createdAt: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    DiningBillModel.aggregate([
      { $match: { vendorId: vendorObjectId, paymentStatus: "Paid", createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          // What the restaurant keeps, after the discounts it funded.
          netRevenue: { $sum: "$restaurantNet" },
          grossBilled: { $sum: "$billAmount" },
          discountGiven: { $sum: { $add: ["$flatDiscount", "$couponDiscount"] } },
          billCount: { $sum: 1 },
        },
      },
    ]),
    TableBookingModel.countDocuments({ vendorId, date: todayStart }),
    TableBookingModel.aggregate([
      { $match: { vendorId: vendorObjectId, date: todayStart, status: { $in: ["Confirmed", "Seated", "Completed"] } } },
      { $group: { _id: null, covers: { $sum: "$partySize" } } },
    ]),
    TableBookingModel.find({ vendorId, date: { $gte: todayStart }, status: { $in: ["Pending", "Confirmed"] } })
      .sort({ date: 1, slotTime: 1 })
      .limit(8)
      .lean(),
    DiningBillModel.find({ vendorId })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("billId customerName billAmount payableAmount restaurantNet outletId createdAt")
      .lean(),
  ]);

  sendSuccess(res, 200, {
    period,
    bookingsByStatus: Object.fromEntries(
      bookingsByStatus.map((b: { _id: string; count: number }) => [b._id, b.count])
    ),
    todayBookingCount: todayBookings,
    todayCovers: coversAgg[0]?.covers ?? 0,
    netRevenue: billTotals[0]?.netRevenue ?? 0,
    grossBilled: billTotals[0]?.grossBilled ?? 0,
    discountGiven: billTotals[0]?.discountGiven ?? 0,
    billCount: billTotals[0]?.billCount ?? 0,
    upcomingBookings: upcoming,
    recentBills,
  });
});
