import { Request, Response } from "express";
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
