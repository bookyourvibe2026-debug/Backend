import { z } from "zod";

const permissionSchema = z.object({
  view: z.boolean().default(false),
  create: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
});

const permissionsMapSchema = z.object({
  dashboard: permissionSchema,
  bookings: permissionSchema,
  listings: permissionSchema,
  earnings: permissionSchema,
  verification: permissionSchema,
  settings: permissionSchema,
  membership: permissionSchema,
  menu: permissionSchema,
  foodOrders: permissionSchema,
  coaches: permissionSchema,
  tournaments: permissionSchema,
});

const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const createVendorStaffSchema = z.object({
  roleName: z.string().trim().min(2).max(80),
  holderName: z.string().trim().min(2).max(120),
  holderEmail: z.string().trim().toLowerCase().email(),
  holderPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  accountType: z.enum(["staff", "subadmin"]),
  password: passwordSchema,
  permissions: permissionsMapSchema,
});

export const updateVendorStaffSchema = z.object({
  roleName: z.string().trim().min(2).max(80).optional(),
  holderName: z.string().trim().min(2).max(120).optional(),
  holderPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  permissions: permissionsMapSchema.optional(),
});

export const staffIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

export const updateVendorProfileSchema = z.object({
  ownerName: z.string().trim().min(2).max(120).optional(),
  businessName: z.string().trim().min(2).max(160).optional(),
  city: z.string().trim().min(2).optional(),
  state: z.string().trim().min(2).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      offline: z.boolean().optional(),
    })
    .optional(),
  logo: z.string().url().optional(),
  banner: z.string().url().optional(),
  poster: z.string().url().optional(),
  businessType: z.enum(["Company", "Individual / Proprietor", "Partnership"]).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  categories: z.array(z.string().trim()).max(5).optional(),
  sports: z.array(z.string().trim()).optional(),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      pinCode: z.string().trim().max(10).optional(),
      country: z.string().trim().max(80).optional(),
    })
    .optional(),
  bankDetails: z
    .object({
      accountNumber: z.string().trim().max(30).optional(),
      ifsc: z.string().trim().max(15).optional(),
      bankName: z.string().trim().max(120).optional(),
      accountType: z.enum(["Savings", "Current"]).optional(),
    })
    .optional(),
});

export const createMembershipSchema = z.object({
  listingId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id").optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  planType: z.enum(["duration", "sessions"]),
  price: z.coerce.number().min(0),
  durationDays: z.coerce.number().int().positive().optional(),
  sessionsIncluded: z.coerce.number().int().positive().optional(),
  turfDimensions: z.string().trim().max(60).optional(),
});

export const updateMembershipSchema = z.object({
  listingId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id").optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().min(0).optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  sessionsIncluded: z.coerce.number().int().positive().optional(),
  turfDimensions: z.string().trim().max(60).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const membershipIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

const priceVariantSchema = z.object({
  label: z.string().trim().min(1).max(40),
  price: z.coerce.number().min(0),
});

export const createMenuItemSchema = z.object({
  outletId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid outlet id").optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().min(0),
  category: z.string().trim().max(60).optional(),
  photo: z.string().url().optional(),
  inStock: z.boolean().optional(),
  prepTimeMins: z.coerce.number().int().min(0).optional(),
  priceVariants: z.array(priceVariantSchema).max(10).optional(),
});

export const updateMenuItemSchema = z.object({
  outletId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid outlet id").optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().min(0).optional(),
  category: z.string().trim().max(60).optional(),
  photo: z.string().url().optional(),
  inStock: z.boolean().optional(),
  prepTimeMins: z.coerce.number().int().min(0).optional(),
  priceVariants: z.array(priceVariantSchema).max(10).optional(),
});

export const menuListQuerySchema = z.object({
  outletId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid outlet id").optional(),
});

export const menuItemIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

export const createSubscriptionSchema = z.object({
  membershipId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
  customerName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  amountPaid: z.coerce.number().min(0),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.enum(["active", "expired", "cancelled"]),
});

/* ─── Expenses ──────────────────────────────────────────────────── */

export const expenseIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

export const createExpenseSchema = z.object({
  category: z.enum(["Maintenance", "Rent", "Salary", "Misc"]),
  amount: z.coerce.number().min(0),
  note: z.string().trim().max(200).optional(),
  spentAt: z.coerce.date().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
