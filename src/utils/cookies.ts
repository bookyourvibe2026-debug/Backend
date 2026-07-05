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

function getCookieDomain(): string | undefined {
  const domain = env.COOKIE_DOMAIN?.trim();
  if (!domain) return undefined;

  // Vercel / production deployments should not keep a localhost cookie domain.
  if (env.isProduction && (domain === "localhost" || domain === "127.0.0.1")) {
    return undefined;
  }

  return domain;
}

export function setRefreshCookie(res: Response, audience: Audience, token: string, maxAgeMs: number): void {
  res.cookie(refreshCookieName(audience), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    domain: getCookieDomain(),
    path: refreshCookiePath(audience),
    maxAge: maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response, audience: Audience): void {
  res.clearCookie(refreshCookieName(audience), {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    domain: getCookieDomain(),
    path: refreshCookiePath(audience),
  });
}

export function getRefreshCookieName(audience: Audience): string {
  return refreshCookieName(audience);
}
