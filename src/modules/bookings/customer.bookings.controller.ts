import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { cancelOwnBooking, createBooking, getBookingByOrderId, listBookingsForCustomer } from "../../services/booking.service";

export const createMyBooking = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  // Google/OTP signups can have no phone on file; without this check the Booking
  // model rejects the missing required field with an unhelpful "Validation failed".
  const phone = req.body.phone ?? customer.phone;
  if (!phone) {
    throw ApiError.badRequest("Please enter your mobile number to complete the booking.");
  }

  const booking = await createBooking({
    ...req.body,
    customerId: customer._id.toString(),
    customerName: req.body.customerName ?? customer.name,
    phone,
    email: req.body.email ?? customer.email,
  });

  // Remember the number so the customer doesn't have to type it again next time.
  if (!customer.phone && req.body.phone) {
    customer.phone = req.body.phone;
    await customer.save().catch(() => undefined);
  }

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
