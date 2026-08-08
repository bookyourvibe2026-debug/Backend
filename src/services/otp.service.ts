import { env } from "../config/env";
import { OtpModel, type OtpPurpose } from "../models/Otp.model";
import { ApiError } from "../utils/ApiError";
import { otpEmailHtml, otpEmailText, sendMail } from "../utils/mailer";
import { generateOtp, hashToken } from "../utils/password";

const MAX_ATTEMPTS = 5;

const PURPOSE_LABELS: Record<OtpPurpose, string> = {
  customer_login: "sign in",
  customer_reset: "reset your password",
  vendor_reset: "reset your password",
  vendor_register: "verify your email",
  vendor_mpin_change: "change your MPIN",
};

const PURPOSE_SUBJECTS: Record<OtpPurpose, string> = {
  customer_login: "Your Book Your Vibe Sign In Code",
  customer_reset: "Reset Your Book Your Vibe Password",
  vendor_reset: "Reset Your Book Your Vibe Password",
  vendor_register: "Verify Your Book Your Vibe Account",
  vendor_mpin_change: "Book Your Vibe MPIN Verification Code",
};

const PURPOSE_TITLES: Record<OtpPurpose, string> = {
  customer_login: "Account Sign In",
  customer_reset: "Password Reset Request",
  vendor_reset: "Password Reset Request",
  vendor_register: "Email Verification",
  vendor_mpin_change: "MPIN Change Request",
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

  if (env.isDevelopment) {
    // eslint-disable-next-line no-console
    console.log(`\n======================================================\n[DEV ONLY] OTP verification code for ${normalizedEmail} (${purpose}): ${code}\n======================================================\n`);

    if (!env.isMailerConfigured) {
      // Local dev convenience only — the code above is logged to the console
      // instead of emailed, so registration/reset can be tested without real SMTP.
      return;
    }
  }

  if (!env.isMailerConfigured) {
    // In production this must be a loud, visible failure — never a silent
    // "success" that hides a missing/broken SMTP config from whoever's watching.
    throw ApiError.serviceUnavailable("Email service isn't configured on the server — the verification code could not be sent.");
  }

  const subject = PURPOSE_SUBJECTS[purpose] ?? "Your Book Your Vibe verification code";
  const title = PURPOSE_TITLES[purpose] ?? "Book Your Vibe";
  const label = PURPOSE_LABELS[purpose] ?? "verify your action";

  await sendMail({
    to: normalizedEmail,
    subject,
    html: otpEmailHtml(code, label, title),
    text: otpEmailText(code, label, title),
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
