import { Schema, model, Types } from "mongoose";

export type BookingStatus = "Confirmed" | "Pending" | "Cancelled" | "Completed" | "Part Paid";
export type PaymentMethod = "Cashfree (Online)" | "Cash (Offline)" | "UPI";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface BookingDocument {
  _id: Types.ObjectId;
  orderId: string;
  listingId: Types.ObjectId;
  vendorId: Types.ObjectId;
  customerId?: Types.ObjectId | null;
  customerName: string;
  phone: string;
  email?: string;
  /** Which sport the slot was booked for (vendor-entered on manual bookings). */
  sport?: string;
  /** Which court on the listing was booked. Absent on bookings taken before courts existed.
   *  When several courts are booked together this holds the first of `courtIds`. */
  courtId?: string;
  /** Court name captured at booking time, so renaming a court doesn't rewrite history. */
  courtName?: string;
  /** Every court this booking occupies. A player can take 2 of 3 courts for the same hour. */
  courtIds?: string[];
  /** Court names captured at booking time, aligned with `courtIds`. */
  courtNames?: string[];
  /** How many players are coming (vendor-entered on manual bookings). */
  numberOfPlayers?: number;
  /** Whether food & beverage is included with this booking. */
  foodIncluded?: boolean;
  /** Whether the customer opted in to Play Protect (+₹19 cancellation & injury cover). */
  playProtect?: boolean;
  dateTime: Date;
  endTime?: string;
  totalAmount: number;
  paidAmount?: number;
  paymentType?: "partial" | "full";
  platformFee: number;
  taxes: number;
  affiliateAmount: number;
  vendorEarning: number;
  /** Set when a Last Minute Boost rule discounted this booking, for receipt/history display. */
  lastMinuteBoost?: {
    ruleId: string;
    discountPct: number;
    originalAmount: number;
    discountAmount: number;
  };
  payment: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentOrderId?: string;
  status: BookingStatus;
  bookingType?: "regular" | "club_together" | "offline";
  isAffiliate: boolean;
  cancellationReason?: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, default: "Club Booking" },
    phone: { type: String, default: "0000000000" },
    email: { type: String },
    sport: { type: String },
    courtId: { type: String },
    courtName: { type: String },
    courtIds: { type: [String], default: undefined },
    courtNames: { type: [String], default: undefined },
    numberOfPlayers: { type: Number, min: 1, max: 200 },
    foodIncluded: { type: Boolean },
    playProtect: { type: Boolean, default: false },
    dateTime: { type: Date, required: true },
    /** Slot end as "HH:mm"; optional so existing bookings stay valid. */
    endTime: { type: String },
    bookingType: { type: String, enum: ["regular", "club_together", "offline"], default: "regular" },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number },
    paymentType: { type: String, enum: ["partial", "full"], default: "partial" },
    platformFee: { type: Number, required: true, min: 0, default: 0 },
    taxes: { type: Number, required: true, min: 0, default: 0 },
    affiliateAmount: { type: Number, required: true, min: 0, default: 0 },
    vendorEarning: { type: Number, required: true, min: 0, default: 0 },
    lastMinuteBoost: {
      type: new Schema(
        {
          ruleId: { type: String, required: true },
          discountPct: { type: Number, required: true },
          originalAmount: { type: Number, required: true },
          discountAmount: { type: Number, required: true },
        },
        { _id: false }
      ),
      required: false,
    },
    payment: { type: String, enum: ["Cashfree (Online)", "Cash (Offline)", "UPI"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paymentOrderId: { type: String },
    status: { type: String, enum: ["Confirmed", "Pending", "Cancelled", "Completed", "Part Paid"], default: "Pending" },
    isAffiliate: { type: Boolean, default: false },
    cancellationReason: { type: String },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ vendorId: 1, dateTime: -1 });
bookingSchema.index({ listingId: 1, dateTime: 1, status: 1 });
bookingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
// Vendor dashboards/exports filter+sort by booking-creation date rather than slot date.
bookingSchema.index({ vendorId: 1, createdAt: -1 });
// Event check-in/arrivals lists filter by checkedIn and sort by check-in time.
bookingSchema.index({ vendorId: 1, checkedIn: 1, checkedInAt: -1 });
// Settled-payments views filter by paymentStatus, sorted by last update.
bookingSchema.index({ paymentStatus: 1, updatedAt: -1 });

export const BookingModel = model<BookingDocument>("Booking", bookingSchema);

