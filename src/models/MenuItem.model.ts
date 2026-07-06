import { Schema, model, Types } from "mongoose";

export interface MenuItemDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  category: string;
  photo?: string;
  inStock: boolean;
  prepTimeMins?: number;
  createdAt: Date;
  updatedAt: Date;
}

const menuItemSchema = new Schema<MenuItemDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: "General" },
    photo: { type: String },
    inStock: { type: Boolean, default: true },
    prepTimeMins: { type: Number, min: 0 },
  },
  { timestamps: true }
);

export const MenuItemModel = model<MenuItemDocument>("MenuItem", menuItemSchema);
