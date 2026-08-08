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
      name: "bookyourvibe.in",
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

// HTML-only messages are a strong spam signal — always send a text/plain part alongside.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const text = input.text ?? htmlToPlainText(input.html);
  const replyTo = input.replyTo ?? env.MAIL_REPLY_TO ?? env.MAIL_FROM;
  const defaultHeaders: Record<string, string> = {
    "Auto-Submitted": "auto-generated",
    "X-Auto-Response-Suppress": "All",
  };

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
          reply_to: replyTo,
          subject: input.subject,
          html: input.html,
          text,
          headers: { ...defaultHeaders, ...input.headers },
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
    replyTo,
    subject: input.subject,
    html: input.html,
    text,
    headers: {
      ...defaultHeaders,
      ...input.headers,
    },
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

export function otpEmailHtml(code: string, purposeLabel: string, headingTitle: string = "Book Your Vibe"): string {
  const preheaderText = `Your security code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headingTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Preheader text without display:none spam trigger -->
  <div style="font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;color:#f8fafc;">
    ${preheaderText}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px 0 rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:28px 32px 0;">
              <h1 style="margin:0;color:#0f172a;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Book Your Vibe</h1>
              <p style="margin:4px 0 0;color:#64748b;font-size:14px;font-weight:600;">${headingTitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;color:#334155;font-size:15px;line-height:1.6;">
              <p style="margin:0;">Use the verification code below to <strong>${purposeLabel}</strong>:</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;">
              <div style="margin:0;padding:16px 0;text-align:center;background-color:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;font-size:34px;font-weight:bold;letter-spacing:10px;color:#0f172a;font-family:Courier,monospace;">${code}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;color:#64748b;font-size:13px;line-height:1.6;">
              <p style="margin:0;">This security code expires in <strong>${env.OTP_TTL_MINUTES} minutes</strong>. If you didn't request this code, you can safely ignore this message — your account is secure and no action is required.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6;background-color:#fafafa;border-bottom-left-radius:12px;border-bottom-right-radius:12px;">
              <p style="margin:0;">Need assistance? Contact our team at <a href="mailto:support@bookyourvibe.in" style="color:#2563eb;text-decoration:none;">support@bookyourvibe.in</a></p>
              <p style="margin:6px 0 0;">&copy; ${new Date().getFullYear()} Book Your Vibe (<a href="https://bookyourvibe.in" style="color:#64748b;text-decoration:none;">bookyourvibe.in</a>). All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function otpEmailText(code: string, purposeLabel: string, headingTitle: string = "Book Your Vibe"): string {
  return [
    `=== ${headingTitle} ===`,
    ``,
    `Your verification code is: ${code}`,
    ``,
    `Use this code to ${purposeLabel}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
    ``,
    `If you didn't request this, you can safely ignore this email — your account remains secure.`,
    ``,
    `Support: support@bookyourvibe.in`,
    `Book Your Vibe — https://bookyourvibe.in`,
  ].join("\n");
}
