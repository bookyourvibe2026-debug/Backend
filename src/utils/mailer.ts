import nodemailer, { type Transporter } from "nodemailer";
import type { ConnectionOptions } from "node:tls";
import { env } from "../config/env";
import { logger } from "../config/logger";
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
      // Many hosts have broken/filtered outbound IPv6 routes to Gmail's SMTP servers, which
      // corrupts the TLS handshake ("wrong version number"). Force IPv4 for the raw socket.
      // `family` is a valid tls.connect()/net.connect() option that the bundled tls types
      // don't declare, so it's threaded through nodemailer's `tls` passthrough with a cast.
      tls: { family: 4 } as ConnectionOptions,
    });
  }
  return transporter;
}

const TRANSIENT_ERROR_CODES = new Set(["ESOCKET", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"]);

export async function sendMail(input: { to: string; subject: string; html: string }): Promise<void> {
  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error({ status: response.status, body: errText, to: input.to }, "Failed to send email via Resend API");
        throw ApiError.serviceUnavailable("Couldn't send the email right now — please try again in a moment.");
      }
      return;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error({ err, to: input.to }, "Failed to send email via Resend API due to a network or server error");
      throw ApiError.serviceUnavailable("Couldn't send the email right now — please try again in a moment.");
    }
  }

  const message = {
    from: env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  };

  try {
    await getTransporter().sendMail(message);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (!code || !TRANSIENT_ERROR_CODES.has(code)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 750));
    try {
      await getTransporter().sendMail(message);
    } catch (retryErr) {
      logger.error({ err: retryErr, to: input.to }, "Failed to send email after retry");
      throw ApiError.serviceUnavailable("Couldn't send the email right now — please try again in a moment.");
    }
  }
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
