import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

/** Tighter limit for auth endpoints (login/register/otp verify) to blunt credential stuffing & brute force. */
export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Too many attempts, please try again later." },
});

/**
 * For endpoints that send an email (OTP request, forgot-password): these always respond 200
 * even when nothing was sent (to avoid leaking account existence), so unlike authRateLimiter this
 * counts successes too — otherwise someone could spam a victim's inbox without ever tripping the limit.
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many code requests, please try again later." },
});
