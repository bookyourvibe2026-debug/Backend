import { z } from "zod";

export const createHostedMatchSchema = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
  sport: z.string().min(1, "Sport is required"),
  dateTime: z.string().min(1, "Date & time string is required"),
  durationMinutes: z.number().int().positive().optional().default(60),
  courtId: z.string().optional(),
  pricingType: z.enum(["host_pays_all", "split_cost"]),
  entryFeePerPlayer: z.number().min(0).optional().default(0),
  maxPlayers: z.number().int().min(2, "Minimum 2 players required").max(50, "Maximum 50 players allowed"),
  hostName: z.string().optional(),
  hostPhone: z.string().optional(),
});

export const confirmHostPaymentSchema = z.object({
  paymentId: z.string().optional(),
});

export const joinHostedMatchSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
});

export const respondToParticipantSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export const confirmPlayerPaymentSchema = z.object({
  participantId: z.string().min(1, "Participant ID is required"),
  paymentId: z.string().optional(),
});
