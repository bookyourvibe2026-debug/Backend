import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  cancelTableBooking,
  createTableBooking,
  getBookingSlots,
  getTableBooking,
  listTableBookingsForCustomer,
} from "../../services/tableBooking.service";
import {
  getDiningBill,
  listDiningBillsForCustomer,
  payDiningBill,
  quoteDiningBill,
} from "../../services/diningBill.service";

/* ─── Table bookings (player) ───────────────────────────────────── */

/** Public — a player can see what's free before signing in. */
export const getSlots = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query as unknown as { date: string };
  const result = await getBookingSlots(req.params.id!, date);
  sendSuccess(res, 200, result);
});

export const bookTable = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const booking = await createTableBooking({
    customerId: customer._id.toString(),
    customerName: customer.name,
    phone: customer.phone ?? "",
    outletId: req.body.outletId,
    date: req.body.date,
    slotTime: req.body.slotTime,
    partySize: req.body.partySize,
    seatingPreference: req.body.seatingPreference,
    selectedOfferCode: req.body.selectedOfferCode,
    occasion: req.body.occasion,
    specialRequests: req.body.specialRequests,
  });
  sendSuccess(res, 201, booking, booking.status === "Confirmed" ? "Table confirmed" : "Booking requested");
});

export const getMyTableBookings = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await listTableBookingsForCustomer(req.auth!.sub, { page, limit });
  sendSuccess(res, 200, result);
});

export const getMyTableBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await getTableBooking(req.params.bookingId!, { customerId: req.auth!.sub });
  sendSuccess(res, 200, booking);
});

export const cancelMyTableBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await cancelTableBooking(req.params.bookingId!, req.auth!.sub);
  sendSuccess(res, 200, booking, "Booking cancelled");
});

/* ─── Dining bills (player) ─────────────────────────────────────── */

/** Public — the breakdown is shown before the player commits to paying. */
export const getBillQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await quoteDiningBill({
    outletId: req.body.outletId,
    billAmount: req.body.billAmount,
    couponCode: req.body.couponCode,
    tipAmount: req.body.tipAmount,
    bankOfferCode: req.body.bankOfferCode,
    walletAmount: req.body.walletAmount,
    rewardPointsRedeemed: req.body.rewardPointsRedeemed,
  });
  sendSuccess(res, 200, quote);
});

export const payBill = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const bill = await payDiningBill({
    customerId: customer._id.toString(),
    customerName: customer.name,
    phone: customer.phone ?? "",
    outletId: req.body.outletId,
    billAmount: req.body.billAmount,
    couponCode: req.body.couponCode,
    tipAmount: req.body.tipAmount,
    bankOfferCode: req.body.bankOfferCode,
    walletAmount: req.body.walletAmount,
    rewardPointsRedeemed: req.body.rewardPointsRedeemed,
    paymentMethod: req.body.paymentMethod,
    bookingId: req.body.bookingId,
    distanceMetres: req.body.distanceMetres,
  });
  sendSuccess(res, 201, bill, "Bill paid");
});

export const getMyBills = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await listDiningBillsForCustomer(req.auth!.sub, { page, limit });
  sendSuccess(res, 200, result);
});

export const getMyBill = asyncHandler(async (req: Request, res: Response) => {
  const bill = await getDiningBill(req.params.billId!, { customerId: req.auth!.sub });
  sendSuccess(res, 200, bill);
});
