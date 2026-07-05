import { Request, Response } from "express";
import { MembershipModel } from "../../models/Membership.model";
import { SubscriptionModel } from "../../models/Subscription.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listMemberships = asyncHandler(async (req: Request, res: Response) => {
  const memberships = await MembershipModel.find({ vendorId: req.vendorId }).sort({ createdAt: -1 });
  sendSuccess(res, 200, memberships);
});

export const createMembership = asyncHandler(async (req: Request, res: Response) => {
  const { planType, durationDays, sessionsIncluded } = req.body;
  if (planType === "duration" && !durationDays) {
    throw ApiError.badRequest("durationDays is required for duration plans");
  }
  if (planType === "sessions" && !sessionsIncluded) {
    throw ApiError.badRequest("sessionsIncluded is required for session plans");
  }

  const membership = await MembershipModel.create({ ...req.body, vendorId: req.vendorId });
  sendSuccess(res, 201, membership, "Membership plan created");
});

export const updateMembership = asyncHandler(async (req: Request, res: Response) => {
  const membership = await MembershipModel.findOne({ _id: req.params.id, vendorId: req.vendorId });
  if (!membership) throw ApiError.notFound("Membership plan not found");

  membership.set(req.body);
  await membership.save();
  sendSuccess(res, 200, membership, "Membership plan updated");
});

export const deleteMembership = asyncHandler(async (req: Request, res: Response) => {
  const membership = await MembershipModel.findOneAndDelete({ _id: req.params.id, vendorId: req.vendorId });
  if (!membership) throw ApiError.notFound("Membership plan not found");
  sendSuccess(res, 200, null, "Membership plan deleted");
});

export const listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const subscriptions = await SubscriptionModel.find({ vendorId: req.vendorId })
    .populate("membershipId", "name planType")
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, subscriptions);
});

export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const membership = await MembershipModel.findOne({ _id: req.body.membershipId, vendorId: req.vendorId });
  if (!membership) throw ApiError.notFound("Membership plan not found for this vendor");

  const startDate = new Date();
  const endDate = membership.planType === "duration" && membership.durationDays
    ? new Date(startDate.getTime() + membership.durationDays * 24 * 60 * 60 * 1000)
    : null;

  const subscription = await SubscriptionModel.create({
    vendorId: req.vendorId,
    membershipId: membership._id,
    customerName: req.body.customerName,
    phone: req.body.phone,
    amountPaid: req.body.amountPaid,
    startDate,
    endDate,
    sessionsRemaining: membership.planType === "sessions" ? membership.sessionsIncluded : undefined,
    status: "active",
  });

  sendSuccess(res, 201, subscription, "Member enrolled");
});

export const updateSubscriptionStatus = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await SubscriptionModel.findOne({ _id: req.params.id, vendorId: req.vendorId });
  if (!subscription) throw ApiError.notFound("Subscription not found");

  subscription.status = req.body.status;
  await subscription.save();
  sendSuccess(res, 200, subscription, "Subscription updated");
});
