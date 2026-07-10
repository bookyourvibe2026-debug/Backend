import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const challengePlayersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const createChallengeSchema = z.object({
  opponentId: objectId.optional(),
  opponentName: z.string().trim().min(2).max(120).optional(),
  opponentPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number")
    .optional(),
  sport: z.string().trim().min(1).max(60),
  venueName: z.string().trim().min(1).max(160),
  scheduleLabel: z.string().trim().min(1).max(120),
  scheduledAt: z.coerce.date().optional(),
  playersCount: z.enum(["1v1", "2v2", "team"]),
  series: z.enum(["BO1", "BO3", "BO5"]),
  matchStyle: z.enum(["friendly", "competitive", "tournament"]),
  entryFee: z.number().min(0),
  stakeType: z.enum([
    "Pizza",
    "Coffee",
    "Burger",
    "Movie",
    "Cash",
    "Trophy",
    "Insta Story",
    "Apology",
    "Reel",
    "Custom",
  ]),
  stakeText: z.string().trim().min(1).max(200),
  inviteBaseUrl: z.string().url().optional(),
});

export const challengeCodeParamSchema = z.object({
  code: z.string().trim().min(4).max(20),
});
