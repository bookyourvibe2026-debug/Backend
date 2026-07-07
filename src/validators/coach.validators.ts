import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const createCoachSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().min(1),
  subCategory: z.string().optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  fees: z.number().nonnegative(),
  bio: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const updateCoachSchema = createCoachSchema.partial();

export const coachIdParamSchema = z.object({
  id: objectId,
});

export const coachSlotParamSchema = z.object({
  id: objectId,
  slotId: z.string().min(1),
});

export const addSlotSchema = z.object({
  date: z.coerce.date(),
  startTime: timeOfDay,
  endTime: timeOfDay,
});

export const publicCoachQuerySchema = z.object({
  category: z.string().optional(),
  vendorId: objectId.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const vendorCoachQuerySchema = z.object({
  status: z.enum(["Active", "Inactive"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const bookCoachSlotSchema = z.object({
  coachId: objectId,
  slotId: z.string().min(1),
  customerName: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number")
    .optional(),
  email: z.string().email().optional(),
  payment: z.enum(["Cashfree (Online)", "Cash (Offline)", "UPI"]),
});

export const coachBookingListQuerySchema = z.object({
  status: z.enum(["Confirmed", "Cancelled", "Completed"]).optional(),
  coachId: objectId.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(1),
});
