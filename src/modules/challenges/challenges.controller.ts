import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import {
  acceptChallenge,
  createChallenge,
  getChallengeByCode,
  listChallengePlayers,
  rejectChallenge,
} from "../../services/challenge.service";

export const getChallengePlayers = asyncHandler(async (req: Request, res: Response) => {
  const { search, limit } = req.query as unknown as { search?: string; limit: number };
  const players = await listChallengePlayers(req.auth!.sub, { search, limit });
  sendSuccess(res, 200, players);
});

export const postChallenge = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await createChallenge(req.auth!.sub, req.body);
  sendSuccess(res, 201, challenge, "Challenge created");
});

export const getChallengeInvite = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await getChallengeByCode(req.params.code!);
  sendSuccess(res, 200, challenge);
});

export const postAcceptChallenge = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await acceptChallenge(req.params.code!, req.auth!.sub);
  sendSuccess(res, 200, challenge, "Challenge accepted");
});

export const postRejectChallenge = asyncHandler(async (req: Request, res: Response) => {
  const challenge = await rejectChallenge(req.params.code!, req.auth!.sub);
  sendSuccess(res, 200, challenge, "Challenge rejected");
});
