import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const idParamSchema = z.object({ id: objectId });

export const vendorStatusUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "suspended"]),
});

export const vendorListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "suspended"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const createVendorSchema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
  state: z.string().trim().min(2),
  city: z.string().trim().min(2).optional(),
  password: passwordSchema,
  status: z.enum(["pending", "approved", "suspended"]).optional(),
});

export const updateVendorSchema = z.object({
  ownerName: z.string().trim().min(2).max(120).optional(),
  businessName: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: phoneSchema.optional(),
  state: z.string().trim().min(2).optional(),
  city: z.string().trim().min(2).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      offline: z.boolean().optional(),
    })
    .optional(),
});

const permissionSchema = z.object({
  view: z.boolean().default(false),
  create: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
});

const adminPermissionsMapSchema = z.object({
  dashboard: permissionSchema,
  vendors: permissionSchema,
  listings: permissionSchema,
  bookings: permissionSchema,
  payouts: permissionSchema,
  blog: permissionSchema,
  marketing: permissionSchema,
  categories: permissionSchema,
  users: permissionSchema,
  subAdmins: permissionSchema,
  systemHealth: permissionSchema,
  appVersion: permissionSchema,
});

export const createAdminSubUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.string().trim().min(2).max(80),
  password: passwordSchema,
  permissions: adminPermissionsMapSchema,
});

export const updateAdminSubUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.string().trim().min(2).max(80).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  permissions: adminPermissionsMapSchema.optional(),
});

export const createBlogPostSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
  thumbnail: z.string().url().optional(),
  content: z.string().min(1),
  status: z.enum(["Published", "Draft"]).optional(),
});

export const updateBlogPostSchema = createBlogPostSchema.partial();

export const payoutCategorySchema = z.object({
  name: z.string().trim().min(1),
  letter: z.string().trim().min(1).max(2),
  color: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
});

export const createVendorPayoutSchema = z.object({
  categoryId: objectId.optional(),
  vendorId: objectId,
  type: z.enum(["Standard", "Affiliate"]).optional(),
  amount: z.number().nonnegative(),
  bookingsCount: z.number().int().nonnegative().optional(),
  bookingIds: z.array(objectId).optional(),
});

export const updateVendorPayoutStatusSchema = z.object({
  status: z.enum(["Pending", "Processing", "Paid", "Failed", "Cancelled"]),
});

export const appVersionUpsertSchema = z.object({
  platform: z.enum(["ios", "android"]),
  currentVersion: z.string().trim().min(1),
  minRequiredVersion: z.string().trim().min(1),
  downloadUrl: z.string().url(),
  releaseNotes: z.string().optional(),
  forceUpdate: z.boolean().optional(),
});
