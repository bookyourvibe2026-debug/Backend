import { Schema, model, Types } from "mongoose";

export type FoodOrderStatus = "Pending" | "Accepted" | "Rejected" | "Preparing" | "Ready" | "Delivered" | "Cancelled";

/** How the player wants the order served.
 *  PreOrder  — placed before the match, picked up on arrival
 *  InVenue   — ordered during play, brought to the court/turf
 *  PostMatch — ordered after the match, collected at the counter
 *  DineIn    — eaten at the venue cafe, served to a table
 *  Counter   — walk-in billed by the Food Owner on the POS / Billing Slide */
export type FoodOrderType = "PreOrder" | "InVenue" | "PostMatch" | "DineIn" | "Counter";

/** Where the order came from — the player app, or the owner's counter POS. */
export type FoodOrderChannel = "app" | "pos";

export interface FoodOrderItem {
  menuItemId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  /** Which size/portion tier was ordered, when the dish has priceVariants. */
  variantLabel?: string;
}

export interface FoodOrderDocument {
  _id: Types.ObjectId;
  orderId: string;
  vendorId: Types.ObjectId;
  /** Outlet the order was placed against. Backfilled for legacy orders. */
  outletId?: Types.ObjectId;
  /** Absent on counter (POS) orders, which have no logged-in player. */
  customerId?: Types.ObjectId;
  customerName: string;
  phone: string;
  items: FoodOrderItem[];
  /** Line-items total, before tax. */
  subtotal: number;
  /** GST charged on the subtotal. */
  taxAmount: number;
  gstRate: number;
  /** Packaging / platform fee, charged on app orders only. */
  packagingFee: number;
  /** subtotal + taxAmount + packagingFee — what the customer actually pays. */
  totalAmount: number;
  status: FoodOrderStatus;
  orderType: FoodOrderType;
  channel: FoodOrderChannel;
  /** Promised prep+service ETA in minutes, frozen at checkout so the player sees the same number later. */
  etaMins?: number;
  /** Pre-orders: when the player will arrive to collect. */
  scheduledFor?: Date | null;
  /** Dine-in table number, or the court/turf to deliver an in-venue order to. */
  serveTo?: string;
  paymentMethod?: string;
  paymentStatus: "Paid" | "Unpaid";
  /** Sequential GST bill number, assigned once the order is billed. */
  billNo?: string;
  notes?: string;
  checkedIn: boolean;
  checkedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const foodOrderItemSchema = new Schema<FoodOrderItem>(
  {
    menuItemId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    variantLabel: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false }
);

const foodOrderSchema = new Schema<FoodOrderDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, required: true },
    outletId: { type: Schema.Types.ObjectId, ref: "FoodOutlet", index: true },
    customerId: { type: Schema.Types.ObjectId },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    items: { type: [foodOrderItemSchema], required: true },
    // Not required: orders placed before GST billing shipped have no breakdown.
    // The pre-save hook below backfills them so accepting an old order still validates.
    subtotal: { type: Number, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 5, min: 0, max: 28 },
    packagingFee: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Preparing", "Ready", "Delivered", "Cancelled"],
      default: "Pending",
    },
    orderType: {
      type: String,
      enum: ["PreOrder", "InVenue", "PostMatch", "DineIn", "Counter"],
      default: "PostMatch",
    },
    channel: { type: String, enum: ["app", "pos"], default: "app" },
    etaMins: { type: Number, min: 0 },
    scheduledFor: { type: Date, default: null },
    serveTo: { type: String, trim: true, maxlength: 60 },
    paymentMethod: { type: String, trim: true, maxlength: 40 },
    paymentStatus: { type: String, enum: ["Paid", "Unpaid"], default: "Paid" },
    billNo: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 300 },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Legacy orders predate the GST breakdown — treat what they charged as the subtotal so
// that touching one (accept, reject, check-in) doesn't trip validation.
foodOrderSchema.pre("save", function backfillBill(next) {
  if (this.subtotal === undefined || this.subtotal === null) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0) || this.totalAmount;
  }
  next();
});

foodOrderSchema.index({ vendorId: 1, createdAt: -1 });
// Customer order-history list filters by customerId, sorted by newest first.
foodOrderSchema.index({ customerId: 1, createdAt: -1 });

export const FoodOrderModel = model<FoodOrderDocument>("FoodOrder", foodOrderSchema);
