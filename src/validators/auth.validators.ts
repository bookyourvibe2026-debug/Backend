import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
  password: passwordSchema,
});

export const customerLoginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone"),
  password: z.string().min(1, "Password is required"),
});

export const customerGoogleAuthSchema = z.object({
  idToken: z.string().min(1, "Missing Google credential"),
});

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const emailOtpVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().length(6, "Enter the 6-digit code"),
});

export const requestEmailOtpSchema = emailSchema;
export const emailOtpLoginSchema = emailOtpVerifySchema;
export const emailOtpVerifyOnlySchema = emailOtpVerifySchema;

export const forgotPasswordSchema = emailSchema;

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().length(6, "Enter the 6-digit code"),
  newPassword: passwordSchema,
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  avatarUrl: z.string().url().optional(),
});

export const vendorRegisterSchema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
  state: z.string().trim().min(2),
  city: z.string().trim().min(2).optional(),
  password: passwordSchema,
  verticals: z.array(z.enum(["turf", "events", "food", "coaches"])).min(1, "Select at least one role"),
});

export const vendorLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

export const vendorStaffLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
