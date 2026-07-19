import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  cancelMySubscription,
  enrollInBatch,
  getSubscriptionByOrderId,
  listMySubscriptions,
} from "../../services/coach.service";

export const createMyCoachSubscription = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const subscription = await enrollInBatch({
    ...req.body,
    customerId: customer._id.toString(),
    customerName: req.body.customerName ?? customer.name,
    phone: req.body.phone ?? customer.phone,
    email: req.body.email ?? customer.email,
  });

  sendSuccess(res, 201, subscription, "Enrolled in batch");
});

export const getMyCoachSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listMySubscriptions(req.auth!.sub, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const getMyCoachSubscriptionByOrderId = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await getSubscriptionByOrderId(req.params.orderId!, { customerId: req.auth!.sub });
  sendSuccess(res, 200, subscription);
});

export const cancelMyCoachSubscriptionRoute = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await cancelMySubscription(req.params.orderId!, req.auth!.sub, req.body.cancellationReason);
  sendSuccess(res, 200, subscription, "Subscription cancelled");
});
