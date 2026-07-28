import { Request, Response } from "express";
import { CustomerModel } from "../../models/Customer.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  confirmHostPayment,
  confirmPlayerPayment,
  createHostedMatch,
  getHostedMatchById,
  listOpenHostedMatches,
  requestToJoinMatch,
  respondToJoinRequest,
} from "../../services/hostedMatch.service";

export const createMyHostedMatch = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);
  if (!customer) throw ApiError.notFound("Customer not found");

  const match = await createHostedMatch(req.auth!.sub, {
    ...req.body,
    hostName: req.body.hostName || customer.name,
    hostPhone: req.body.hostPhone || customer.phone,
    hostEmail: req.body.hostEmail || customer.email,
  });

  sendSuccess(res, 201, match, "Hosted match created");
});

export const confirmMyHostPayment = asyncHandler(async (req: Request, res: Response) => {
  const match = await confirmHostPayment(req.params.id!, req.auth!.sub);
  sendSuccess(res, 200, match, "Host payment confirmed and slot reserved");
});

export const getOpenHostedMatches = asyncHandler(async (req: Request, res: Response) => {
  const { sport, date, limit } = req.query as unknown as { sport?: string; date?: string; limit?: number };
  const matches = await listOpenHostedMatches({ sport, date, limit: Number(limit) || 30 });
  sendSuccess(res, 200, matches);
});

export const getHostedMatchDetails = asyncHandler(async (req: Request, res: Response) => {
  const match = await getHostedMatchById(req.params.id!);
  sendSuccess(res, 200, match);
});

export const joinMyHostedMatch = asyncHandler(async (req: Request, res: Response) => {
  const customer = await CustomerModel.findById(req.auth!.sub);

  const match = await requestToJoinMatch(req.params.id!, {
    customerId: req.auth!.sub,
    name: req.body.name || customer?.name || "Player",
    phone: req.body.phone || customer?.phone,
    email: customer?.email,
  });

  sendSuccess(res, 200, match, "Join request sent to host");
});

export const respondToMyParticipantRequest = asyncHandler(async (req: Request, res: Response) => {
  const result = await respondToJoinRequest(
    req.params.id!,
    req.auth!.sub,
    req.params.participantId!,
    req.body.action
  );
  sendSuccess(res, 200, result, `Participant request ${req.body.action}ed`);
});

export const confirmMyPlayerPayment = asyncHandler(async (req: Request, res: Response) => {
  const match = await confirmPlayerPayment(req.params.id!, req.body.participantId, req.auth!.sub);
  sendSuccess(res, 200, match, "Player entry fee payment confirmed");
});
