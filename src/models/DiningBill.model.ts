import { Schema, model, Types } from "mongoose";

/**
 * A restaurant bill settled through the app — the player types in the total printed on
 * their bill, the restaurant's flat discount comes off, and BYV's convenience fee goes on.
 *
 * Amounts are stored in rupees. Every figure the player was shown is persisted rather than
 * recomputed later, so a historical bill always reconciles even after the outlet changes
 * its discount.
 */
export interface DiningBillDocument {
  _id: Types.ObjectId;
  billId: string;
  vendorId: Types.ObjectId;
  outletId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  phone: string;
  /** Reservation this bill was settled against, when the player came via a booking. */
  bookingId?: string;
  /** Total as printed on the restaurant's bill, before any BYV discount. */
  billAmount: number;
  /** Outlet's flat player discount, frozen at payment time. */
  flatDiscountPct: number;
  flatDiscount: number;
  couponCode?: string;
  couponDiscount: number;
  bankOfferCode?: string;
  bankOfferDiscount?: number;
  walletAmount?: number;
  rewardPointsRedeemed?: number;
  cashbackEarned?: number;
  /** BYV's fee, inclusive of GST — split below purely for the bill breakdown. */
  convenienceFee: number;
  gstOnConvenienceFee: number;
  convenienceFeeTotal: number;
  tipAmount: number;
  /** What the player actually paid, rounded to the nearest rupee. */
  payableAmount: number;
  /** Rupees the restaurant keeps: billAmount less the discounts it funded. */
  restaurantNet: number;
  paymentMethod?: string;
  paymentStatus: "Paid" | "Failed" | "Pending";
  /** Metres between the player and the outlet when they paid — flags wrong-outlet taps. */
  distanceMetres?: number;
  createdAt: Date;
  updatedAt: Date;
}

const diningBillSchema = new Schema<DiningBillDocument>(
  {
    billId: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    outletId: { type: Schema.Types.ObjectId, ref: "FoodOutlet", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    bookingId: { type: String, trim: true },
    billAmount: { type: Number, required: true, min: 1 },
    flatDiscountPct: { type: Number, default: 0, min: 0, max: 100 },
    flatDiscount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 30 },
    couponDiscount: { type: Number, default: 0, min: 0 },
    bankOfferCode: { type: String, trim: true, uppercase: true, maxlength: 30 },
    bankOfferDiscount: { type: Number, default: 0, min: 0 },
    walletAmount: { type: Number, default: 0, min: 0 },
    rewardPointsRedeemed: { type: Number, default: 0, min: 0 },
    cashbackEarned: { type: Number, default: 0, min: 0 },
    convenienceFee: { type: Number, default: 0, min: 0 },
    gstOnConvenienceFee: { type: Number, default: 0, min: 0 },
    convenienceFeeTotal: { type: Number, default: 0, min: 0 },
    tipAmount: { type: Number, default: 0, min: 0 },
    payableAmount: { type: Number, required: true, min: 0 },
    restaurantNet: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, trim: true, maxlength: 40 },
    paymentStatus: { type: String, enum: ["Paid", "Failed", "Pending"], default: "Paid" },
    distanceMetres: { type: Number, min: 0 },
  },
  { timestamps: true }
);

diningBillSchema.index({ vendorId: 1, createdAt: -1 });
diningBillSchema.index({ customerId: 1, createdAt: -1 });

export const DiningBillModel = model<DiningBillDocument>("DiningBill", diningBillSchema);
