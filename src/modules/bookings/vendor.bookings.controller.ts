import { Request, Response } from "express";
import * as xlsx from "xlsx";
import { BookingModel } from "../../models/Booking.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  checkInBooking,
  createManualBooking,
  getBookingByOrderId,
  listBookingsForVendor,
  updateBookingStatus,
} from "../../services/booking.service";

export const getVendorBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listBookingsForVendor(req.vendorId!, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const createVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await createManualBooking(req.vendorId!, req.body);
  sendSuccess(res, 201, booking, "Booking created");
});

export const getVendorBookingByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getBookingByOrderId(req.params.orderId!, { vendorId: req.vendorId! });
  sendSuccess(res, 200, booking);
});

export const updateVendorBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const booking = await updateBookingStatus(
    req.params.orderId!,
    req.body.status,
    { vendorId: req.vendorId! },
    req.body.cancellationReason
  );
  sendSuccess(res, 200, booking, "Booking updated");
});

export const checkInVendorBooking = asyncHandler(async (req: Request, res: Response) => {
  const { booking, alreadyCheckedIn } = await checkInBooking(req.params.orderId!, req.vendorId!);
  sendSuccess(res, 200, booking, alreadyCheckedIn ? "Already checked in" : "Checked in");
});

export const exportBookingsToExcel = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await BookingModel.find({ vendorId: req.vendorId })
    .populate("listingId", "title")
    .sort({ dateTime: -1 })
    .lean();

  const data = bookings.map((b: any) => ({
    "Customer Name": b.customerName,
    "Court": b.listingId?.title || "N/A",
    "Amount Paid (₹)": b.totalAmount,
    "Date": new Date(b.dateTime).toLocaleDateString("en-IN"),
    "Time": new Date(b.dateTime).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }),
    "Booking Type": b.payment === "Cash (Offline)" ? "Offline" : "Online",
    "Status": b.status,
    "Payment Status": b.paymentStatus
  }));

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Bookings");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", 'attachment; filename="bookings_report.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});
