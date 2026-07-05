import { Response } from "express";
import { env } from "../config/env";
import { Audience } from "./jwt";

function refreshCookieName(audience: Audience): string {
  return `${audience}_rt`;
}

/** Refresh cookie is path-scoped to its own refresh endpoint so it never rides along on unrelated requests. */
function refreshCookiePath(audience: Audience): string {
  return `${env.API_PREFIX}/auth/${audience}/refresh`;
}

export function setRefreshCookie(res: Response, audience: Audience, token: string, maxAgeMs: number): void {
  res.cookie(refreshCookieName(audience), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: refreshCookiePath(audience),
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response, audience: Audience): void {
  res.clearCookie(refreshCookieName(audience), {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: refreshCookiePath(audience),
  });
}

export function getRefreshCookieName(audience: Audience): string {
  return refreshCookieName(audience);
}
