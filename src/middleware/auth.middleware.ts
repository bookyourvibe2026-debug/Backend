import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { Audience, verifyAccessToken } from "../utils/jwt";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return null;
}

/**
 * Builds an auth guard scoped to one audience (customer/vendor/admin) so a customer
 * access token can never be replayed against vendor or admin routes, and vice versa.
 */
export function requireAuth(audience: Audience) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);
    if (!token) {
      next(ApiError.unauthorized("Missing access token"));
      return;
    }

    try {
      const payload = verifyAccessToken(token, audience);
      req.auth = payload;
      next();
    } catch {
      next(ApiError.unauthorized("Invalid or expired access token"));
    }
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(ApiError.forbidden("You do not have permission to perform this action"));
      return;
    }
    next();
  };
}
