import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getBookingByOrderId, listBookingsForAdmin, updateBookingStatus } from "../../services/booking.service";

export const getAdminBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listBookingsForAdmin({ status, page, limit });
  sendSuccess(res, 200, {
    ...result,
    items: result.items.map((booking) => {
      const listing = booking.listingId as unknown as { _id: unknown; title?: string } | null;
      return {
        ...booking,
        listingId: listing?._id ?? booking.listingId,
        listingTitle: listing?.title ?? "Deleted listing",
      };
    }),
  });
});

export const getAdminBookingByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getBookingByOrderId(req.params.orderId!);
  sendSuccess(res, 200, booking);
});

export const updateAdminBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const booking = await updateBookingStatus(req.params.orderId!, req.body.status, {}, req.body.cancellationReason);
  sendSuccess(res, 200, booking, "Booking updated");
});
