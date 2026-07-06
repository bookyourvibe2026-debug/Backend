import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { ApiError } from "./ApiError";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!env.isMailerConfigured) {
    throw ApiError.serviceUnavailable("Email service isn't configured on the server yet");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(input: { to: string; subject: string; html: string }): Promise<void> {
  await getTransporter().sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}

export function otpEmailHtml(code: string, purposeLabel: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Book Your Vibe</h2>
      <p>Your one-time code to ${purposeLabel} is:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${code}</p>
      <p style="color: #64748b; font-size: 13px;">This code expires in ${env.OTP_TTL_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}
