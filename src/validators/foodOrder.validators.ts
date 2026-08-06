import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const orderType = z.enum(["PreOrder", "InVenue", "PostMatch", "DineIn", "Counter"]);

export const foodOrderListQuerySchema = z.object({
  status: z.enum(["Pending", "Accepted", "Rejected", "Preparing", "Ready", "Delivered", "Cancelled"]).optional(),
  /** Omit to see every turf's orders in one list. */
  outletId: objectId.optional(),
  orderType: orderType.optional(),
  /** "upcoming" = still in the kitchen, "history" = closed out. */
  scope: z.enum(["upcoming", "history"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
});

export const updateFoodOrderStatusSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Preparing", "Ready", "Cancelled"]),
});

export const myFoodOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
});

export const foodVendorIdParamSchema = z.object({
  vendorId: objectId,
});

const orderLines = z
  .array(
    z.object({
      menuItemId: objectId,
      quantity: z.coerce.number().int().positive(),
      variantLabel: z.string().trim().max(40).optional(),
    })
  )
  .min(1, "Add at least one item");

export const createFoodOrderSchema = z.object({
  /** Either outletId (new flow) or vendorId (legacy clients) must identify the kitchen. */
  outletId: objectId.optional(),
  vendorId: objectId.optional(),
  items: orderLines,
  /** Defaults to PostMatch so older clients that don't send a type still work. */
  orderType: orderType.exclude(["Counter"]).optional(),
  /** Required for PreOrder — enforced in createFoodOrder. */
  scheduledFor: z.string().datetime().optional(),
  serveTo: z.string().trim().max(60).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(300).optional(),
  // Note: at least one of outletId/vendorId is required — enforced in createFoodOrder,
  // which throws "Restaurant not found" when neither resolves (validate() needs a plain ZodObject).
});

/** Price + ETA preview shown before the player pays. */
export const quoteFoodOrderSchema = z.object({
  outletId: objectId.optional(),
  vendorId: objectId.optional(),
  items: orderLines,
  orderType: orderType.exclude(["Counter"]).optional(),
});

/** Walk-in bill rung up on the Food Owner's Billing Slide / POS. */
export const createCounterOrderSchema = z.object({
  outletId: objectId,
  items: orderLines,
  customerName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  paymentMethod: z.enum(["Cash", "UPI", "Card", "Other"]).optional(),
  paymentStatus: z.enum(["Paid", "Unpaid"]).optional(),
  notes: z.string().trim().max(300).optional(),
});
