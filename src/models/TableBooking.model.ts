import { Schema, model, Types } from "mongoose";

export type TableBookingStatus =
  | "Pending"
  | "Confirmed"
  | "Rejected"
  | "Seated"
  | "Completed"
  | "Cancelled"
  | "NoShow";

/**
 * A dining reservation at a partner restaurant — the Dineout half of Food & Beverages.
 *
 * Players book a table while they're at (or heading to) a turf; the restaurant confirms,
 * then scans the booking QR when the party walks in.
 */
export interface TableBookingDocument {
  _id: Types.ObjectId;
  bookingId: string;
  vendorId: Types.ObjectId;
  outletId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  phone: string;
  /** Midnight of the reservation day, so a day's bookings group cleanly. */
  date: Date;
  /** Slot start, "HH:mm" in the restaurant's local time. */
  slotTime: string;
  partySize: number;
  seatingPreference?: string;
  selectedOfferCode?: string;
  occasion?: string;
  specialRequests?: string;
  status: TableBookingStatus;
  /** Why the restaurant turned the booking down, shown to the player. */
  rejectionReason?: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const tableBookingSchema = new Schema<TableBookingDocument>(
  {
    bookingId: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    outletId: { type: Schema.Types.ObjectId, ref: "FoodOutlet", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    date: { type: Date, required: true },
    slotTime: { type: String, required: true },
    partySize: { type: Number, required: true, min: 1, max: 100 },
    seatingPreference: { type: String, trim: true, maxlength: 40 },
    selectedOfferCode: { type: String, trim: true, maxlength: 40 },
    occasion: { type: String, trim: true, maxlength: 60 },
    specialRequests: { type: String, trim: true, maxlength: 300 },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Rejected", "Seated", "Completed", "Cancelled", "NoShow"],
      default: "Pending",
    },
    rejectionReason: { type: String, trim: true, maxlength: 200 },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Slot-availability counts read by outlet + day.
tableBookingSchema.index({ outletId: 1, date: 1, slotTime: 1 });
// The vendor's reservation board, newest first.
tableBookingSchema.index({ vendorId: 1, date: -1 });
// The player's "my bookings" list.
tableBookingSchema.index({ customerId: 1, createdAt: -1 });

export const TableBookingModel = model<TableBookingDocument>("TableBooking", tableBookingSchema);
