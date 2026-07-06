import { env } from "../config/env";
import { OtpModel, type OtpPurpose } from "../models/Otp.model";
import { ApiError } from "../utils/ApiError";
import { otpEmailHtml, sendMail } from "../utils/mailer";
import { generateOtp, hashToken } from "../utils/password";

const MAX_ATTEMPTS = 5;

const PURPOSE_LABELS: Record<OtpPurpose, string> = {
  customer_login: "sign in",
  customer_reset: "reset your password",
  vendor_reset: "reset your password",
  vendor_register: "verify your email",
};

export async function requestOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOtp();

  await OtpModel.create({
    email: normalizedEmail,
    purpose,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000),
  });

  await sendMail({
    to: normalizedEmail,
    subject: "Your Book Your Vibe verification code",
    html: otpEmailHtml(code, PURPOSE_LABELS[purpose]),
  });
}

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const otp = await OtpModel.findOne({ email: normalizedEmail, purpose, consumedAt: null }).sort({ createdAt: -1 });

  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized("Invalid or expired OTP");
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw ApiError.unauthorized("Too many incorrect attempts. Please request a new OTP");
  }
  if (otp.codeHash !== hashToken(code)) {
    otp.attempts += 1;
    await otp.save();
    throw ApiError.unauthorized("Invalid or expired OTP");
  }

  otp.consumedAt = new Date();
  await otp.save();
}
