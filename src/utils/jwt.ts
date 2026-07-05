import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type Audience = "customer" | "vendor" | "admin";

export interface AccessTokenPayload {
  sub: string;
  audience: Audience;
  role: string;
  vendorId?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  audience: Audience;
  role: string;
  jti: string;
  vendorId?: string;
}

const ISSUER = "byv-backend";

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: ISSUER,
    audience: payload.audience,
  } as SignOptions);
}

export function verifyAccessToken(token: string, audience: Audience): AccessTokenPayload {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET, { issuer: ISSUER, audience }) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
    issuer: ISSUER,
    audience: payload.audience,
  } as SignOptions);
}

export function verifyRefreshToken(token: string, audience: Audience): RefreshTokenPayload {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET, { issuer: ISSUER, audience }) as RefreshTokenPayload;
}
