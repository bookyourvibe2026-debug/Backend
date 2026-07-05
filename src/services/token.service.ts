import { randomUUID } from "crypto";
import { Response } from "express";
import { Types } from "mongoose";
import { env } from "../config/env";
import { RefreshTokenModel } from "../models/RefreshToken.model";
import { clearRefreshCookie, setRefreshCookie } from "../utils/cookies";
import { parseDurationToMs } from "../utils/duration";
import { hashToken } from "../utils/password";
import { ApiError } from "../utils/ApiError";
import {
  Audience,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

interface IssueTokenPairInput {
  userId: Types.ObjectId | string;
  audience: Audience;
  role: string;
  vendorId?: string;
  userAgent?: string;
  ip?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TTL_MS = parseDurationToMs(env.REFRESH_TOKEN_TTL);

export async function issueTokenPair(input: IssueTokenPairInput): Promise<TokenPair> {
  const jti = randomUUID();
  const sub = input.userId.toString();

  const accessToken = signAccessToken({
    sub,
    audience: input.audience,
    role: input.role,
    vendorId: input.vendorId,
  });

  const refreshToken = signRefreshToken({
    sub,
    audience: input.audience,
    role: input.role,
    vendorId: input.vendorId,
    jti,
  });

  await RefreshTokenModel.create({
    userId: sub,
    audience: input.audience,
    role: input.role,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: input.userAgent,
    createdByIp: input.ip,
  });

  return { accessToken, refreshToken };
}

export function attachAuthCookies(res: Response, audience: Audience, refreshToken: string): void {
  setRefreshCookie(res, audience, refreshToken, REFRESH_TTL_MS);
}

export function clearAuthCookies(res: Response, audience: Audience): void {
  clearRefreshCookie(res, audience);
}

/**
 * Rotates a refresh token: verifies the JWT, cross-checks it against the stored hash for
 * its jti, and revokes the whole session family if the hash doesn't match (a strong signal
 * the token was intercepted and already used) before issuing a fresh pair.
 */
export async function rotateRefreshToken(
  rawToken: string,
  audience: Audience,
  meta: { userAgent?: string; ip?: string }
): Promise<TokenPair & { userId: string; role: string; vendorId?: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(rawToken, audience);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const stored = await RefreshTokenModel.findOne({ jti: payload.jti });
  if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized("Session expired, please log in again");
  }

  if (stored.tokenHash !== hashToken(rawToken)) {
    await RefreshTokenModel.updateMany(
      { userId: stored.userId, audience, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw ApiError.unauthorized("Session invalidated, please log in again");
  }

  stored.revokedAt = new Date();
  const pair = await issueTokenPair({
    userId: stored.userId,
    audience,
    role: payload.role,
    vendorId: payload.vendorId,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  stored.replacedByJti = extractJti(pair.refreshToken);
  await stored.save();

  return { ...pair, userId: stored.userId.toString(), role: payload.role, vendorId: payload.vendorId };
}

export async function revokeRefreshToken(rawToken: string, audience: Audience): Promise<void> {
  try {
    const payload = verifyRefreshToken(rawToken, audience);
    await RefreshTokenModel.updateOne({ jti: payload.jti }, { $set: { revokedAt: new Date() } });
  } catch {
    // Token already invalid/expired — nothing to revoke.
  }
}

export async function revokeAllSessions(userId: string, audience: Audience): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId, audience, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

function extractJti(refreshToken: string): string {
  const payloadB64 = refreshToken.split(".")[1];
  if (!payloadB64) throw new Error("Malformed refresh token");
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  return payload.jti as string;
}

export const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TTL_MS;
