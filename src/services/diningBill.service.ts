import { FilterQuery } from "mongoose";
import { DiningBillDocument, DiningBillModel } from "../models/DiningBill.model";
import { FoodOutletDocument, FoodOutletModel } from "../models/FoodOutlet.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";

/** BYV's fee per settled bill, inclusive of GST. Split out purely for the bill breakdown. */
const CONVENIENCE_FEE_TOTAL = 10;
/** GST slab on the convenience fee (a service). */
const FEE_GST_RATE = 18;

/** Coupons a player can stack on top of the restaurant's flat discount. */
const COUPONS: Record<string, { percent: number; maxDiscount: number; minBill: number }> = {
  DINE250: { percent: 10, maxDiscount: 250, minBill: 500 },
  DINE100: { percent: 10, maxDiscount: 100, minBill: 300 },
};

/** Bank partner offers the app can surface during dining settlement. */
const BANK_OFFERS: Record<string, { percent: number; maxDiscount: number; minBill: number }> = {
  HDFC10: { percent: 10, maxDiscount: 250, minBill: 500 },
  ICICI8: { percent: 8, maxDiscount: 200, minBill: 400 },
  SBI7: { percent: 7, maxDiscount: 150, minBill: 300 },
  AXIS5: { percent: 5, maxDiscount: 100, minBill: 300 },
  CITI6: { percent: 6, maxDiscount: 120, minBill: 400 },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface DiningBillBreakdown {
  billAmount: number;
  flatDiscountPct: number;
  flatDiscount: number;
  couponCode?: string;
  couponDiscount: number;
  bankOfferCode?: string;
  bankOfferDiscount: number;
  walletAmount: number;
  rewardPointsRedeemed: number;
  cashbackEarned: number;
  /** Reason the coupon didn't apply, so the player isn't left guessing. */
  couponError?: string;
  convenienceFee: number;
  gstOnConvenienceFee: number;
  convenienceFeeTotal: number;
  tipAmount: number;
  payableAmount: number;
  totalSavings: number;
  restaurantNet: number;
}

/**
 * Price a restaurant bill the way the player sees it:
 *
 *   bill − restaurant's flat discount − coupon + convenience fee (incl. GST) + tip,
 *   rounded to the nearest rupee.
 *
 * The restaurant funds the discounts; BYV takes the convenience fee. Every figure is
 * returned so the payment screen and the stored record agree line for line.
 */
export function priceDiningBill(input: {
  billAmount: number;
  outlet: Pick<FoodOutletDocument, "dineout">;
  couponCode?: string;
  tipAmount?: number;
  bankOfferCode?: string;
  walletAmount?: number;
  rewardPointsRedeemed?: number;
}): DiningBillBreakdown {
  const billAmount = Math.max(0, input.billAmount);
  const flatDiscountPct = input.outlet.dineout?.flatDiscountPct ?? 0;
  const flatDiscount = round2((billAmount * flatDiscountPct) / 100);

  let couponDiscount = 0;
  let couponError: string | undefined;
  let couponCode: string | undefined;

  if (input.couponCode) {
    const code = input.couponCode.trim().toUpperCase();
    const coupon = COUPONS[code];
    if (!coupon) {
      couponError = "That coupon code isn't valid";
    } else if (billAmount < coupon.minBill) {
      couponError = `Applies on bills above ₹${coupon.minBill}`;
    } else {
      couponCode = code;
      couponDiscount = round2(Math.min((billAmount * coupon.percent) / 100, coupon.maxDiscount));
    }
  }

  let bankOfferCode: string | undefined;
  let bankOfferDiscount = 0;
  if (input.bankOfferCode) {
    const code = input.bankOfferCode.trim().toUpperCase();
    const offer = BANK_OFFERS[code];
    if (offer && billAmount >= offer.minBill) {
      bankOfferCode = code;
      bankOfferDiscount = round2(Math.min((billAmount * offer.percent) / 100, offer.maxDiscount));
    }
  }

  // The fee is quoted GST-inclusive, so back the tax out of it rather than adding on top.
  const gstOnConvenienceFee = round2((CONVENIENCE_FEE_TOTAL * FEE_GST_RATE) / (100 + FEE_GST_RATE));
  const convenienceFee = round2(CONVENIENCE_FEE_TOTAL - gstOnConvenienceFee);
  const tipAmount = Math.max(0, round2(input.tipAmount ?? 0));

  // Discounts can never exceed the bill itself.
  const restaurantDiscountTotal = Math.min(flatDiscount + couponDiscount + bankOfferDiscount, billAmount);
  const afterRestaurantDiscounts = Math.max(0, billAmount - restaurantDiscountTotal);
  const walletRequested = Math.max(0, round2(input.walletAmount ?? 0));
  const walletAmount = Math.min(walletRequested, afterRestaurantDiscounts);
  const afterWallet = Math.max(0, afterRestaurantDiscounts - walletAmount);
  const rewardRequested = Math.max(0, round2(input.rewardPointsRedeemed ?? 0));
  const rewardPointsRedeemed = Math.min(rewardRequested, afterWallet);
  const afterRewards = Math.max(0, afterWallet - rewardPointsRedeemed);
  const payableAmount = Math.round(afterRewards + CONVENIENCE_FEE_TOTAL + tipAmount);
  const cashbackEarned = round2(Math.max(0, afterRestaurantDiscounts * 0.1));

  return {
    billAmount,
    flatDiscountPct,
    flatDiscount,
    couponCode,
    couponDiscount,
    bankOfferCode,
    bankOfferDiscount,
    walletAmount,
    rewardPointsRedeemed,
    cashbackEarned,
    couponError,
    convenienceFee,
    gstOnConvenienceFee,
    convenienceFeeTotal: CONVENIENCE_FEE_TOTAL,
    tipAmount,
    payableAmount: Math.max(0, payableAmount),
    totalSavings: round2(restaurantDiscountTotal + walletAmount + rewardPointsRedeemed),
    restaurantNet: round2(afterRestaurantDiscounts),
  };
}

async function findPayableOutlet(idOrSlug: string): Promise<FoodOutletDocument> {
  const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
  const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const outlet = await FoodOutletModel.findOne({ ...query, status: "Active" });
  if (!outlet) throw ApiError.notFound("Restaurant not found");
  if (!outlet.dineout?.payBill) {
    throw ApiError.badRequest("This restaurant isn't accepting bill payments through the app yet");
  }
  return outlet;
}

/** Bill breakdown preview — nothing is charged or stored. */
export async function quoteDiningBill(input: {
  outletId: string;
  billAmount: number;
  couponCode?: string;
  tipAmount?: number;
  bankOfferCode?: string;
  walletAmount?: number;
  rewardPointsRedeemed?: number;
}) {
  const outlet = await findPayableOutlet(input.outletId);
  return {
    outletId: outlet._id.toString(),
    outletName: outlet.name,
    ...priceDiningBill({
      billAmount: input.billAmount,
      outlet,
      couponCode: input.couponCode,
      tipAmount: input.tipAmount,
      bankOfferCode: input.bankOfferCode,
      walletAmount: input.walletAmount,
      rewardPointsRedeemed: input.rewardPointsRedeemed,
    }),
  };
}

export async function payDiningBill(input: {
  customerId: string;
  customerName: string;
  phone: string;
  outletId: string;
  billAmount: number;
  couponCode?: string;
  tipAmount?: number;
  bankOfferCode?: string;
  walletAmount?: number;
  rewardPointsRedeemed?: number;
  paymentMethod?: string;
  bookingId?: string;
  distanceMetres?: number;
}) {
  if (input.billAmount <= 0) throw ApiError.badRequest("Enter the bill amount printed on your bill");

  const outlet = await findPayableOutlet(input.outletId);
  const breakdown = priceDiningBill({
    billAmount: input.billAmount,
    outlet,
    couponCode: input.couponCode,
    tipAmount: input.tipAmount,
    bankOfferCode: input.bankOfferCode,
    walletAmount: input.walletAmount,
    rewardPointsRedeemed: input.rewardPointsRedeemed,
  });

  // A coupon the player believed was applied must not silently vanish from the charge.
  if (input.couponCode && breakdown.couponError) {
    throw ApiError.badRequest(breakdown.couponError);
  }

  return DiningBillModel.create({
    billId: generateOrderId(),
    vendorId: outlet.vendorId,
    outletId: outlet._id,
    customerId: input.customerId,
    customerName: input.customerName,
    phone: input.phone,
    bookingId: input.bookingId,
    billAmount: breakdown.billAmount,
    flatDiscountPct: breakdown.flatDiscountPct,
    flatDiscount: breakdown.flatDiscount,
    couponCode: breakdown.couponCode,
    couponDiscount: breakdown.couponDiscount,
    bankOfferCode: breakdown.bankOfferCode,
    bankOfferDiscount: breakdown.bankOfferDiscount,
    walletAmount: breakdown.walletAmount,
    rewardPointsRedeemed: breakdown.rewardPointsRedeemed,
    cashbackEarned: breakdown.cashbackEarned,
    convenienceFee: breakdown.convenienceFee,
    gstOnConvenienceFee: breakdown.gstOnConvenienceFee,
    convenienceFeeTotal: breakdown.convenienceFeeTotal,
    tipAmount: breakdown.tipAmount,
    payableAmount: breakdown.payableAmount,
    restaurantNet: breakdown.restaurantNet,
    paymentMethod: input.paymentMethod ?? "UPI",
    paymentStatus: "Paid",
    distanceMetres: input.distanceMetres,
  });
}

export async function listDiningBillsForCustomer(customerId: string, filters: { page: number; limit: number }) {
  return paginate({ customerId }, filters);
}

export async function listDiningBillsForVendor(
  vendorId: string,
  filters: { outletId?: string; page: number; limit: number }
) {
  const filter: FilterQuery<DiningBillDocument> = { vendorId };
  if (filters.outletId) filter.outletId = filters.outletId;
  return paginate(filter, filters);
}

async function paginate(filter: FilterQuery<DiningBillDocument>, { page, limit }: { page: number; limit: number }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    DiningBillModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    DiningBillModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getDiningBill(billId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<DiningBillDocument> = { billId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const bill = await DiningBillModel.findOne(filter);
  if (!bill) throw ApiError.notFound("Bill not found");
  return bill;
}
