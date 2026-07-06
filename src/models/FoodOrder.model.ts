import { Schema, model, Types } from "mongoose";

export type FoodOrderStatus = "Pending" | "Accepted" | "Rejected" | "Preparing" | "Ready" | "Delivered" | "Cancelled";

export interface FoodOrderItem {
  menuItemId: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface FoodOrderDocument {
  _id: Types.ObjectId;
  orderId: string;
  vendorId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  phone: string;
  items: FoodOrderItem[];
  totalAmount: number;
  status: FoodOrderStatus;
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
  },
  { _id: false }
);

const foodOrderSchema = new Schema<FoodOrderDocument>(
  {
    orderId: { type: String, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, required: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    items: { type: [foodOrderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Preparing", "Ready", "Delivered", "Cancelled"],
      default: "Pending",
    },
    notes: { type: String, trim: true, maxlength: 300 },
    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { timestamps: true }
);

foodOrderSchema.index({ vendorId: 1, createdAt: -1 });

export const FoodOrderModel = model<FoodOrderDocument>("FoodOrder", foodOrderSchema);
