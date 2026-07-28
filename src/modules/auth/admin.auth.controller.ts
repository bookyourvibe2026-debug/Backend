import { Request, Response } from "express";
import { AdminModel } from "../../models/Admin.model";
import { AdminSubUserModel } from "../../models/AdminSubUser.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { comparePassword } from "../../utils/password";
import { attachAuthCookies, clearAuthCookies, issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "../../services/token.service";
import { getRefreshCookieName } from "../../utils/cookies";

const AUDIENCE = "admin" as const;

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const admin = await AdminModel.findOne({ email }).select("+passwordHash");
  if (admin) {
    if (!(await comparePassword(password, admin.passwordHash))) {
      throw ApiError.unauthorized("Invalid credentials");
    }
    if (admin.status === "Inactive") {
      throw ApiError.forbidden("This account has been deactivated.");
    }

    const pair = await issueTokenPair({
      userId: admin._id,
      audience: AUDIENCE,
      role: "super_admin",
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    attachAuthCookies(res, AUDIENCE, pair.refreshToken);

    sendSuccess(res, 200, {
      accessToken: pair.accessToken,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: "super_admin" },
    }, "Logged in");
    return;
  }

  const subUser = await AdminSubUserModel.findOne({ email }).select("+passwordHash");
  if (!subUser || !(await comparePassword(password, subUser.passwordHash))) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (subUser.status === "Inactive") {
    throw ApiError.forbidden("This account has been deactivated.");
  }

  const pair = await issueTokenPair({
    userId: subUser._id,
    audience: AUDIENCE,
    role: "sub_admin",
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, pair.refreshToken);

  sendSuccess(res, 200, {
    accessToken: pair.accessToken,
    admin: { id: subUser._id, name: subUser.name, email: subUser.email, role: "sub_admin", roleLabel: subUser.role },
  }, "Logged in");
});

export const refreshAdmin = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[getRefreshCookieName(AUDIENCE)];
  if (!rawToken) throw ApiError.unauthorized("Missing refresh token");

  const result = await rotateRefreshToken(rawToken, AUDIENCE, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, result.refreshToken);

  sendSuccess(res, 200, { accessToken: result.accessToken }, "Token refreshed");
});

export const logoutAdmin = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[getRefreshCookieName(AUDIENCE)];
  if (rawToken) await revokeRefreshToken(rawToken, AUDIENCE);
  clearAuthCookies(res, AUDIENCE);
  sendSuccess(res, 200, null, "Logged out");
});

export const getCurrentAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (req.auth?.role === "super_admin") {
    const admin = await AdminModel.findById(req.auth.sub);
    if (!admin) throw ApiError.notFound("Admin not found");
    sendSuccess(res, 200, { id: admin._id, name: admin.name, email: admin.email, role: "super_admin" });
    return;
  }

  const subUser = await AdminSubUserModel.findById(req.auth?.sub);
  if (!subUser) throw ApiError.notFound("Admin not found");
  sendSuccess(res, 200, {
    id: subUser._id,
    name: subUser.name,
    email: subUser.email,
    role: "sub_admin",
    roleLabel: subUser.role,
    permissions: subUser.permissions,
  });
});
