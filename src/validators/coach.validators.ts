import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
/** Accepts either a real ObjectId or a URL slug — used where customers hit a coach by its public link. */
const idOrSlug = z.string().regex(/^[a-f\d]{24}$|^[a-z0-9-]+$/i, "Invalid coach id or slug");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const locationSchema = z.object({
  address: z.string().max(300).optional(),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const phone = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number");

const inlineBatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startTime: timeOfDay,
  endTime: timeOfDay,
  days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  capacity: z.number().int().positive().max(1000),
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative(),
  demoAvailable: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const createCoachSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().min(1),
  categories: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  subCategory: z.string().optional(),
  phone: phone.optional(),
  email: z.string().email().max(160).optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  fees: z.number().nonnegative().optional(),
  bio: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
  gallery: z.array(z.string().url()).max(30).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  location: locationSchema.optional(),
  /** Slots/batches can be created inline with the coach in one save. */
  batches: z.array(inlineBatchSchema).max(30).optional(),
});

export const updateCoachSchema = createCoachSchema.partial();

export const coachIdParamSchema = z.object({
  id: idOrSlug,
});

export const batchParamSchema = z.object({
  id: objectId,
  batchId: z.string().min(1),
});

/** Weekly availability: the full 7-day week the vendor sets at once. */
export const weeklyAvailabilitySchema = z.object({
  days: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        startTime: timeOfDay,
        endTime: timeOfDay,
      })
    )
    .max(7),
});

const batchBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  startTime: timeOfDay,
  endTime: timeOfDay,
  days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  capacity: z.number().int().positive().max(1000),
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative(),
  demoAvailable: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const createBatchSchema = batchBodySchema;
export const updateBatchSchema = batchBodySchema.partial();

export const addLeaveSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["full", "half"]).optional(),
  reason: z.string().max(200).optional(),
});

export const leaveDateParamSchema = z.object({
  id: objectId,
  date: z.string().min(1), // ISO date string identifying the leave
});

export const publicCoachQuerySchema = z.object({
  category: z.string().optional(),
  vendorId: objectId.optional(),
  city: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const vendorCoachQuerySchema = z.object({
  status: z.enum(["Active", "Inactive"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const enrollCoachSchema = z.object({
  coachId: objectId,
  batchId: z.string().min(1),
  plan: z.enum(["demo", "monthly", "yearly"]),
  customerName: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number")
    .optional(),
  email: z.string().email().optional(),
  payment: z.enum(["Cashfree (Online)", "Cash (Offline)", "UPI"]),
});

export const subscriptionListQuerySchema = z.object({
  status: z.enum(["Active", "Cancelled", "Expired"]).optional(),
  coachId: objectId.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(1),
});
