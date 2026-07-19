import { Schema, model, Types } from "mongoose";

/** Optional size/portion tier for a dish — e.g. Small ₹80 / Medium ₹120 / Large ₹150. */
export interface PriceVariant {
  label: string;
  price: number;
}

export interface MenuItemDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  /** Restaurant/outlet this dish belongs to. Backfilled to the vendor's default outlet for legacy items. */
  outletId?: Types.ObjectId;
  name: string;
  description?: string;
  /** Flat price, or the "starting from" price when priceVariants exist. */
  price: number;
  category: string;
  photo?: string;
  inStock: boolean;
  prepTimeMins?: number;
  /** When non-empty, the customer must pick one of these when ordering. */
  priceVariants: PriceVariant[];
  createdAt: Date;
  updatedAt: Date;
}

const priceVariantSchema = new Schema<PriceVariant>(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const menuItemSchema = new Schema<MenuItemDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    outletId: { type: Schema.Types.ObjectId, ref: "FoodOutlet", index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: "General" },
    photo: { type: String },
    inStock: { type: Boolean, default: true },
    prepTimeMins: { type: Number, min: 0 },
    priceVariants: { type: [priceVariantSchema], default: [] },
  },
  { timestamps: true }
);

// Keep the display price in sync as "starting from" when variants exist.
menuItemSchema.pre("save", function syncPrice(next) {
  if (this.priceVariants.length > 0) {
    this.price = Math.min(...this.priceVariants.map((v) => v.price));
  }
  next();
});

menuItemSchema.index({ outletId: 1, category: 1 });

export const MenuItemModel = model<MenuItemDocument>("MenuItem", menuItemSchema);
