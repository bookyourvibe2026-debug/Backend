import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { cancelOwnBooking, createBooking, getBookingByOrderId, listBookingsForCustomer } from "../../services/booking.service";

export const createMyBooking = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const booking = await createBooking({
    ...req.body,
    customerId: customer._id.toString(),
    customerName: req.body.customerName ?? customer.name,
    phone: req.body.phone ?? customer.phone,
    email: req.body.email ?? customer.email,
  });

  sendSuccess(res, 201, booking, "Booking created");
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listBookingsForCustomer(req.auth!.sub, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const getMyBookingByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getBookingByOrderId(req.params.orderId!, { customerId: req.auth!.sub });
  sendSuccess(res, 200, booking);
});

export const cancelMyBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await cancelOwnBooking(req.params.orderId!, req.auth!.sub, req.body.cancellationReason);
  sendSuccess(res, 200, booking, "Booking cancelled");
});
