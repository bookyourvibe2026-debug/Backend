import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const createBookingSchema = z.object({
  listingId: objectId,
  priceTierId: z.string().optional(),
  addOnIds: z.array(z.string()).optional(),
  couponCode: z.string().optional(),
  dateTime: z.coerce.date(),
  customerName: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  payment: z.enum(["Cashfree (Online)", "Cash (Offline)", "UPI"]),
  sport: z.string().trim().max(60).optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(1),
});

export const createManualBookingSchema = z.object({
  listingId: objectId,
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  sport: z.string().trim().max(60).optional(),
  numberOfPlayers: z.coerce.number().int().min(1).max(200).optional(),
  foodIncluded: z.boolean().optional(),
  dateTime: z.coerce.date(),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/).optional(),
  totalAmount: z.coerce.number().positive(),
  paidAmount: z.coerce.number().min(0).optional(),
  payment: z.enum(["Cashfree (Online)", "Cash (Offline)", "UPI"]),
  status: z.enum(["Confirmed", "Pending", "Cancelled", "Completed", "Part Paid"]).default("Confirmed"),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["Confirmed", "Pending", "Cancelled", "Completed", "Part Paid"]),
  cancellationReason: z.string().max(500).optional(),
});

export const bookingListQuerySchema = z.object({
  status: z.enum(["Confirmed", "Pending", "Cancelled", "Completed", "Part Paid"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
});
