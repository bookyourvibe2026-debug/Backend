import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  attachAuthCookies,
  clearAuthCookies,
  issueTokenPair,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../../services/token.service";
import { requestOtp, verifyOtp } from "../../services/otp.service";
import { getRefreshCookieName } from "../../utils/cookies";
import { env } from "../../config/env";

const AUDIENCE = "customer" as const;

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

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
    customer: { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone, avatarUrl: customer.avatarUrl },
  }, "Account created");
});

export const loginCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  const customer = await CustomerModel.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select("+passwordHash");

  if (!customer || !customer.passwordHash || !(await comparePassword(password, customer.passwordHash))) {
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
    customer: { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone, avatarUrl: customer.avatarUrl },
  }, "Logged in");
});

export const googleAuthCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (!googleClient) {
    throw ApiError.serviceUnavailable("Google sign-in isn't configured on the server yet");
  }

  const { idToken } = req.body;

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized("Invalid or expired Google credential");
  }

  if (!payload?.email) {
    throw ApiError.unauthorized("Invalid or expired Google credential");
  }
  const { sub: googleId, email, name, picture } = payload;

  let customer = await CustomerModel.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

  if (customer) {
    if (!customer.googleId) {
      customer.googleId = googleId;
      if (!customer.avatarUrl && picture) customer.avatarUrl = picture;
      await customer.save();
    }
  } else {
    customer = await CustomerModel.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      googleId,
      avatarUrl: picture,
      isEmailVerified: !!payload.email_verified,
    });
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
    customer: { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone, avatarUrl: customer.avatarUrl },
  }, "Logged in");
});

export const requestCustomerLoginOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  await requestOtp(email, "customer_login");
  sendSuccess(res, 200, null, "If that email is valid, a code has been sent.");
});

export const loginCustomerWithOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  await verifyOtp(email, "customer_login", otp);

  let customer = await CustomerModel.findOne({ email: email.toLowerCase() });
  if (!customer) {
    customer = await CustomerModel.create({
      name: email.split("@")[0],
      email: email.toLowerCase(),
      isEmailVerified: true,
    });
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
    customer: { id: customer._id, name: customer.name, email: customer.email, phone: customer.phone, avatarUrl: customer.avatarUrl },
  }, "Logged in");
});

export const forgotCustomerPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const customer = await CustomerModel.findOne({ email: email.toLowerCase() });
  if (customer) {
    await requestOtp(email, "customer_reset");
  }
  sendSuccess(res, 200, null, "If that email is registered, a reset code has been sent.");
});

export const resetCustomerPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  await verifyOtp(email, "customer_reset", otp);

  const customer = await CustomerModel.findOne({ email: email.toLowerCase() });
  if (!customer) throw ApiError.notFound("Account not found");

  customer.passwordHash = await hashPassword(newPassword);
  await customer.save();
  await revokeAllSessions(customer._id.toString(), AUDIENCE);

  sendSuccess(res, 200, null, "Password reset. Please log in with your new password.");
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
    avatarUrl: customer.avatarUrl,
    status: customer.status,
  });
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, avatarUrl } = req.body;

  const customer = await CustomerModel.findByIdAndUpdate(
    req.auth?.sub,
    { ...(name !== undefined && { name }), ...(avatarUrl !== undefined && { avatarUrl }) },
    { new: true }
  );
  if (!customer) throw ApiError.notFound("Customer not found");

  sendSuccess(res, 200, {
    id: customer._id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    avatarUrl: customer.avatarUrl,
    status: customer.status,
  }, "Profile updated");
});
