import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const foodOrderListQuerySchema = z.object({
  status: z.enum(["Pending", "Accepted", "Rejected", "Preparing", "Ready", "Delivered", "Cancelled"]).optional(),
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

export const createFoodOrderSchema = z.object({
  /** Either outletId (new flow) or vendorId (legacy clients) must identify the kitchen. */
  outletId: objectId.optional(),
  vendorId: objectId.optional(),
  items: z
    .array(
      z.object({
        menuItemId: objectId,
        quantity: z.coerce.number().int().positive(),
        variantLabel: z.string().trim().max(40).optional(),
      })
    )
    .min(1, "Add at least one item"),
  notes: z.string().trim().max(300).optional(),
  // Note: at least one of outletId/vendorId is required — enforced in createFoodOrder,
  // which throws "Restaurant not found" when neither resolves (validate() needs a plain ZodObject).
});
