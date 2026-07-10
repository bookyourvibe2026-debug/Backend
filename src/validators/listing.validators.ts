import { z } from "zod";

const imageSchema = z.object({ id: z.string(), url: z.string().url(), label: z.string() });
const faqSchema = z.object({ question: z.string().min(1), answer: z.string().min(1) });
const itinerarySchema = z.object({ day: z.number().int().positive(), title: z.string().min(1), description: z.string() });
const priceTierSchema = z.object({ id: z.string(), label: z.string().min(1), amount: z.number().nonnegative() });
const addOnSchema = z.object({ id: z.string(), label: z.string().min(1), price: z.number().nonnegative() });
const couponSchema = z.object({ id: z.string(), code: z.string().min(2), discountPercent: z.number().min(0).max(100) });

export const createListingSchema = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.enum(["Turf", "Game", "Event"]),
  categories: z.array(z.string()).min(1),
  subCategories: z.array(z.string()).optional(),
  price: z.number().nonnegative(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  trending: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  coverImage: z.string().url().optional(),
  images: z.array(imageSchema).optional(),
  country: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  cityMode: z.enum(["single", "multiple"]).optional(),
  cities: z.array(z.string()).optional(),
  address: z.string().min(1),
  startingPoint: z.string().optional(),
  endingPoint: z.string().optional(),
  reportingStartTime: z.string().optional(),
  reportingEndTime: z.string().optional(),
  description: z.string().min(1),
  highlights: z.array(z.string()).optional(),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  itinerary: z.array(itinerarySchema).optional(),
  faqs: z.array(faqSchema).optional(),
  tags: z.array(z.string()).optional(),
  priceTiers: z.array(priceTierSchema).optional(),
  addOns: z.array(addOnSchema).optional(),
  coupons: z.array(couponSchema).optional(),
  bookingType: z.enum(["Recurring", "Trips", "Courses"]).optional(),
  availableFrom: z.coerce.date(),
  availableTill: z.coerce.date(),
  slotsPerDay: z.number().int().positive(),
  slotsList: z
    .array(
      z.object({
        startTime: z.string(),
        endTime: z.string(),
        label: z.string(),
        price: z.number().nonnegative(),
      })
    )
    .optional(),
  dailyRoutine: z.boolean().optional(),
  dateOverrides: z
    .array(
      z.object({
        date: z.string(),
        isHoliday: z.boolean(),
        holidayName: z.string(),
        slots: z.array(
          z.object({
            startTime: z.string(),
            endTime: z.string(),
            label: z.string(),
            price: z.number().nonnegative(),
          })
        ),
      })
    )
    .optional(),
});

export const updateListingSchema = createListingSchema.partial();

export const listingIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid listing id"),
});

export const vendorIdParamSchema = z.object({
  vendorId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid vendor id"),
});

export const publicListingQuerySchema = z.object({
  city: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  type: z.enum(["Turf", "Game", "Event"]).optional(),
  vendorId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
