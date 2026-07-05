import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/** Cryptographically random 6-digit OTP. Not a bcrypt candidate — short-lived & rate-limited instead. */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** SHA-256 fingerprint used to store/lookup opaque tokens (refresh tokens, OTPs) without keeping the raw value at rest. */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateSecureToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("hex");
}
