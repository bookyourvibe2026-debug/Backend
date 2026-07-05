import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { comparePassword, hashPassword } from "../../utils/password";
import { attachAuthCookies, clearAuthCookies, issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "../../services/token.service";
import { getRefreshCookieName } from "../../utils/cookies";

const AUDIENCE = "customer" as const;

export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password } = req.body;

  const existing = await CustomerModel.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    throw ApiError.conflict("An account with this email or phone already exists");
  }

  const passwordHash = await hashPassword(password);
  const customer = await CustomerModel.create({ name, email, phone, passwordHash });

  const pair = await issueTokenPair({
    userId: customer._id,
    audience: AUDIENCE,
    role: "customer",
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, pair.refreshToken);

  sendSuccess(res, 201, {
    accessToken: pair.accessToken,
    customer: { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone },
  }, "Account created");
});

export const loginCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  const customer = await CustomerModel.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select("+passwordHash");

  if (!customer || !(await comparePassword(password, customer.passwordHash))) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (customer.status === "blocked") {
    throw ApiError.forbidden("This account has been blocked. Contact support.");
  }

  const pair = await issueTokenPair({
    userId: customer._id,
    audience: AUDIENCE,
    role: "customer",
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, pair.refreshToken);

  sendSuccess(res, 200, {
    accessToken: pair.accessToken,
    customer: { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone },
  }, "Logged in");
});

export const refreshCustomer = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[getRefreshCookieName(AUDIENCE)];
  if (!rawToken) throw ApiError.unauthorized("Missing refresh token");

  const result = await rotateRefreshToken(rawToken, AUDIENCE, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, result.refreshToken);

  sendSuccess(res, 200, { accessToken: result.accessToken }, "Token refreshed");
});

export const logoutCustomer = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[getRefreshCookieName(AUDIENCE)];
  if (rawToken) await revokeRefreshToken(rawToken, AUDIENCE);
  clearAuthCookies(res, AUDIENCE);
  sendSuccess(res, 200, null, "Logged out");
});

export const getCurrentCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth?.sub);
  if (!customer) throw ApiError.notFound("Customer not found");
  sendSuccess(res, 200, {
    id: customer._id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
  });
});
