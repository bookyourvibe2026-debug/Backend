import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
/** Accepts either a real ObjectId or a URL slug — for public outlet detail links. */
const idOrSlug = z.string().regex(/^[a-f\d]{24}$|^[a-z0-9-]+$/i, "Invalid outlet id or slug");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

const locationSchema = z.object({
  address: z.string().max(300).optional(),
  area: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const createOutletSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["dining", "venue"]).optional(),
  offer: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  cuisines: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  logo: z.string().url().optional(),
  banner: z.string().url().optional(),
  poster: z.string().url().optional(),
  gallery: z.array(z.string().url()).max(30).optional(),
  location: locationSchema.optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const updateOutletSchema = createOutletSchema.partial();

export const outletIdParamSchema = z.object({
  id: objectId,
});

export const publicOutletParamSchema = z.object({
  id: idOrSlug,
});

export const outletWeeklyAvailabilitySchema = z.object({
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

export const outletLeaveSchema = z.object({
  date: z.coerce.date(),
  type: z.enum(["full", "half"]).optional(),
  reason: z.string().max(200).optional(),
});

export const outletLeaveDateParamSchema = z.object({
  id: objectId,
  date: z.string().min(1),
});

export const publicOutletQuerySchema = z.object({
  cuisine: z.string().optional(),
  city: z.string().optional(),
  kind: z.enum(["dining", "venue"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
