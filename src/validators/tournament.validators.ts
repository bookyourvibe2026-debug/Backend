import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const createTournamentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.string().min(1),
  subCategory: z.string().optional(),
  description: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  address: z.string().min(1),
  entryFee: z.number().nonnegative(),
  prizeMoney: z.number().nonnegative().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  registrationDeadline: z.coerce.date(),
  maxTeams: z.number().int().positive().optional(),
  status: z.enum(["Upcoming", "Ongoing", "Completed", "Cancelled"]).optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial();

export const tournamentIdParamSchema = z.object({
  id: objectId,
});

export const fixtureParamSchema = z.object({
  id: objectId,
  fixtureId: z.string().min(1),
});

export const publicTournamentQuerySchema = z.object({
  category: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(["Upcoming", "Ongoing", "Completed", "Cancelled"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const vendorTournamentQuerySchema = z.object({
  status: z.enum(["Upcoming", "Ongoing", "Completed", "Cancelled"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const playerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().optional(),
});

export const registerTeamSchema = z.object({
  tournamentId: objectId,
  teamName: z.string().trim().min(2).max(120),
  captainName: z.string().trim().min(2).max(120).optional(),
  captainPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number")
    .optional(),
  captainEmail: z.string().trim().toLowerCase().email().optional(),
  players: z.array(playerSchema).min(1),
  payment: z.enum(["Cashfree (Online)", "Cash (Offline)", "UPI"]),
});

export const addFixtureSchema = z.object({
  round: z.string().trim().min(1).max(80),
  teamAId: objectId,
  teamBId: objectId,
  scheduledAt: z.coerce.date(),
});

export const updateFixtureResultSchema = z.object({
  teamAScore: z.number().int().nonnegative(),
  teamBScore: z.number().int().nonnegative(),
  winnerTeamId: objectId.optional(),
});

export const registrationListQuerySchema = z.object({
  status: z.enum(["Registered", "Cancelled", "Withdrawn"]).optional(),
  tournamentId: objectId.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(1),
});
