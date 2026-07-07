import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  cancelMyRegistration,
  getRegistrationByOrderId,
  listMyRegistrations,
  registerTeam,
} from "../../services/tournament.service";

export const createMyRegistration = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const registration = await registerTeam({
    ...req.body,
    customerId: customer._id.toString(),
    captainName: req.body.captainName ?? customer.name,
    captainPhone: req.body.captainPhone ?? customer.phone,
    captainEmail: req.body.captainEmail ?? customer.email,
  });

  sendSuccess(res, 201, registration, "Team registered");
});

export const getMyRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listMyRegistrations(req.auth!.sub, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const getMyRegistrationByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const registration = await getRegistrationByOrderId(req.params.orderId!, { customerId: req.auth!.sub });
  sendSuccess(res, 200, registration);
});

export const cancelMyRegistrationRoute = asyncHandler(async (req: Request, res: Response) => {
  const registration = await cancelMyRegistration(req.params.orderId!, req.auth!.sub, req.body.cancellationReason);
  sendSuccess(res, 200, registration, "Registration cancelled");
});
