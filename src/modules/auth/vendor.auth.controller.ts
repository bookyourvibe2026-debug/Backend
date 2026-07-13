import { Request, Response } from "express";
import { VendorModel } from "../../models/Vendor.model";
import { VendorStaffModel } from "../../models/VendorStaff.model";
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

const AUDIENCE = "vendor" as const;

export const registerVendor = asyncHandler(async (req: Request, res: Response) => {
  const { ownerName, businessName, email, phone, state, city, password, verticals } = req.body;

  const existing = await VendorModel.findOne({ $or: [{ email }, { phone }] });
  if (existing) {
    throw ApiError.conflict("A vendor account with this email or phone already exists");
  }

  const passwordHash = await hashPassword(password);
  const vendor = await VendorModel.create({
    ownerName,
    businessName,
    email,
    phone,
    state,
    city,
    passwordHash,
    verticals,
    status: "pending",
  });

  const pair = await issueTokenPair({
    userId: vendor._id,
    audience: AUDIENCE,
    role: "vendor",
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, pair.refreshToken);

  sendSuccess(
    res,
    201,
    {
      accessToken: pair.accessToken,
      vendor: {
        id: vendor._id,
        ownerName: vendor.ownerName,
        businessName: vendor.businessName,
        email: vendor.email,
        status: vendor.status,
        verticals: vendor.verticals,
        role: "vendor",
      },
    },
    "Vendor account created. Approval is pending from the admin team."
  );
});

export const loginVendor = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const vendor = await VendorModel.findOne({ email }).select("+passwordHash");
  if (vendor) {
    if (!(await comparePassword(password, vendor.passwordHash))) {
      throw ApiError.unauthorized("Invalid credentials");
    }
    if (vendor.status === "suspended") {
      throw ApiError.forbidden("This vendor account has been suspended.");
    }

    const pair = await issueTokenPair({
      userId: vendor._id,
      audience: AUDIENCE,
      role: "vendor",
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    attachAuthCookies(res, AUDIENCE, pair.refreshToken);

    sendSuccess(res, 200, {
      accessToken: pair.accessToken,
      vendor: {
        id: vendor._id,
        ownerName: vendor.ownerName,
        businessName: vendor.businessName,
        email: vendor.email,
        status: vendor.status,
        verticals: vendor.verticals,
        role: "vendor",
      },
    }, "Logged in");
    return;
  }

  const staff = await VendorStaffModel.findOne({ holderEmail: email }).select("+passwordHash");
  if (!staff || !(await comparePassword(password, staff.passwordHash))) {
    throw ApiError.unauthorized("Invalid credentials");
  }
  if (staff.status === "Inactive") {
    throw ApiError.forbidden("This account has been deactivated. Contact your business owner.");
  }

  const pair = await issueTokenPair({
    userId: staff._id,
    audience: AUDIENCE,
    role: staff.accountType,
    vendorId: staff.vendorId.toString(),
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, pair.refreshToken);

  const parentVendor = await VendorModel.findById(staff.vendorId).select("verticals");

  sendSuccess(res, 200, {
    accessToken: pair.accessToken,
    vendor: {
      id: staff._id,
      vendorId: staff.vendorId,
      holderName: staff.holderName,
      roleName: staff.roleName,
      email: staff.holderEmail,
      role: staff.accountType,
      verticals: parentVendor?.verticals ?? ["turf"],
      permissions: staff.permissions,
    },
  }, "Logged in");
});

export const requestVendorRegisterOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const existing = await VendorModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict("A vendor account with this email already exists");
  }
  await requestOtp(email, "vendor_register");
  sendSuccess(res, 200, null, "Verification code sent to your email");
});

export const verifyVendorRegisterOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  await verifyOtp(email, "vendor_register", otp);
  sendSuccess(res, 200, null, "Email verified");
});

export const forgotVendorPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const vendor = await VendorModel.findOne({ email: email.toLowerCase() });
  if (vendor) {
    await requestOtp(email, "vendor_reset");
  }
  sendSuccess(res, 200, null, "If that email is registered, a reset code has been sent.");
});

export const resetVendorPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  await verifyOtp(email, "vendor_reset", otp);

  const vendor = await VendorModel.findOne({ email: email.toLowerCase() });
  if (!vendor) throw ApiError.notFound("Account not found");

  vendor.passwordHash = await hashPassword(newPassword);
  await vendor.save();
  await revokeAllSessions(vendor._id.toString(), AUDIENCE);

  sendSuccess(res, 200, null, "Password reset. Please log in with your new password.");
});

export const refreshVendor = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[getRefreshCookieName(AUDIENCE)];
  if (!rawToken) throw ApiError.unauthorized("Missing refresh token");

  const result = await rotateRefreshToken(rawToken, AUDIENCE, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  attachAuthCookies(res, AUDIENCE, result.refreshToken);

  sendSuccess(res, 200, { accessToken: result.accessToken }, "Token refreshed");
});

export const logoutVendor = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[getRefreshCookieName(AUDIENCE)];
  if (rawToken) await revokeRefreshToken(rawToken, AUDIENCE);
  clearAuthCookies(res, AUDIENCE);
  sendSuccess(res, 200, null, "Logged out");
});

export const getCurrentVendor = asyncHandler(async (req: Request, res: Response) => {
  if (req.auth?.role === "vendor") {
    const vendor = await VendorModel.findById(req.auth.sub);
    if (!vendor) throw ApiError.notFound("Vendor not found");
    sendSuccess(res, 200, {
      id: vendor._id,
      ownerName: vendor.ownerName,
      businessName: vendor.businessName,
      email: vendor.email,
      status: vendor.status,
      verticals: vendor.verticals,
      role: "vendor",
    });
    return;
  }

  const staff = await VendorStaffModel.findById(req.auth?.sub);
  if (!staff) throw ApiError.notFound("Account not found");
  const parentVendor = await VendorModel.findById(staff.vendorId).select("verticals");
  sendSuccess(res, 200, {
    id: staff._id,
    vendorId: staff.vendorId,
    holderName: staff.holderName,
    roleName: staff.roleName,
    email: staff.holderEmail,
    role: staff.accountType,
    verticals: parentVendor?.verticals ?? ["turf"],
    permissions: staff.permissions,
  });
});
