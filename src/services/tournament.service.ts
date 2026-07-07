import { FilterQuery, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { TournamentDocument, TournamentFixture, TournamentModel } from "../models/Tournament.model";
import { TournamentRegistrationDocument, TournamentRegistrationModel } from "../models/TournamentRegistration.model";
import { ApiError } from "../utils/ApiError";
import { generateOrderId } from "../utils/orderId";
import { paymentProvider } from "./payment/payment.service";

export interface CreateTournamentInput {
  title: string;
  category: string;
  subCategory?: string;
  description: string;
  city: string;
  state: string;
  address: string;
  entryFee: number;
  prizeMoney?: number;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  maxTeams?: number;
  status?: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
}

export async function createTournament(vendorId: string, input: CreateTournamentInput) {
  return TournamentModel.create({ ...input, vendorId, registeredTeamsCount: 0, fixtures: [] });
}

export async function getTournamentForVendor(vendorId: string, tournamentId: string) {
  const tournament = await TournamentModel.findOne({ _id: tournamentId, vendorId });
  if (!tournament) throw ApiError.notFound("Tournament not found");
  return tournament;
}

export async function updateTournament(vendorId: string, tournamentId: string, input: Partial<CreateTournamentInput>) {
  const tournament = await getTournamentForVendor(vendorId, tournamentId);
  tournament.set(input);
  await tournament.save();
  return tournament;
}

export async function listTournamentsForVendor(vendorId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<TournamentDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  return paginateTournaments(filter, filters);
}

export async function listPublicTournaments(filters: {
  category?: string;
  city?: string;
  status?: string;
  page: number;
  limit: number;
}) {
  const filter: FilterQuery<TournamentDocument> = { status: { $ne: "Cancelled" } };
  if (filters.category) filter.category = filters.category;
  if (filters.city) filter.city = filters.city;
  if (filters.status) filter.status = filters.status;
  return paginateTournaments(filter, filters);
}

async function paginateTournaments(
  filter: FilterQuery<TournamentDocument>,
  { page, limit }: { page: number; limit: number }
) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    TournamentModel.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit),
    TournamentModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

/** Always derived from fixtures + registrations — never stored, so it can't drift out of sync. */
function computeLeaderboard(tournament: TournamentDocument, registrations: TournamentRegistrationDocument[]): LeaderboardEntry[] {
  const table = new Map<string, LeaderboardEntry>();
  for (const reg of registrations) {
    if (reg.status !== "Registered") continue;
    table.set(reg._id.toString(), {
      teamId: reg._id.toString(),
      teamName: reg.teamName,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
    });
  }

  for (const fixture of tournament.fixtures) {
    if (fixture.status !== "Completed") continue;
    const a = table.get(fixture.teamAId.toString());
    const b = table.get(fixture.teamBId.toString());
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;

    if (fixture.winnerTeamId) {
      const winnerIsA = fixture.winnerTeamId.toString() === a.teamId;
      const winner = winnerIsA ? a : b;
      const loser = winnerIsA ? b : a;
      winner.wins += 1;
      winner.points += 3;
      loser.losses += 1;
    } else {
      a.draws += 1;
      b.draws += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  return Array.from(table.values()).sort((x, y) => y.points - x.points || y.wins - x.wins);
}

export async function getPublicTournamentById(tournamentId: string) {
  const tournament = await TournamentModel.findOne({ _id: tournamentId, status: { $ne: "Cancelled" } });
  if (!tournament) throw ApiError.notFound("Tournament not found");

  const registrations = await TournamentRegistrationModel.find({ tournamentId: tournament._id, status: "Registered" });

  return {
    ...tournament.toObject(),
    spotsLeft: tournament.maxTeams ? Math.max(tournament.maxTeams - tournament.registeredTeamsCount, 0) : undefined,
    leaderboard: computeLeaderboard(tournament, registrations),
  };
}

export interface RegisterTeamInput {
  tournamentId: string;
  customerId?: string;
  teamName: string;
  captainName: string;
  captainPhone: string;
  captainEmail?: string;
  players: { name: string; phone?: string }[];
  payment: "Cashfree (Online)" | "Cash (Offline)" | "UPI";
}

export async function registerTeam(input: RegisterTeamInput): Promise<TournamentRegistrationDocument> {
  const filter: FilterQuery<TournamentDocument> = {
    _id: input.tournamentId,
    status: { $in: ["Upcoming", "Ongoing"] },
  };

  let tournament: TournamentDocument | null;
  const unclaimed = await TournamentModel.findOne(filter);
  if (!unclaimed) throw ApiError.notFound("Tournament not found or not open for registration");

  if (unclaimed.maxTeams) {
    // Atomic claim: only increments if the cap hasn't been hit, mirroring the coach-slot claim pattern.
    tournament = await TournamentModel.findOneAndUpdate(
      { ...filter, $expr: { $lt: ["$registeredTeamsCount", "$maxTeams"] } },
      { $inc: { registeredTeamsCount: 1 } },
      { new: true }
    );
    if (!tournament) throw ApiError.badRequest("This tournament is full");
  } else {
    tournament = await TournamentModel.findOneAndUpdate(filter, { $inc: { registeredTeamsCount: 1 } }, { new: true });
    if (!tournament) throw ApiError.notFound("Tournament not found or not open for registration");
  }

  const orderId = generateOrderId();

  let paymentOrderId: string | undefined;
  if (input.payment === "Cashfree (Online)" && tournament.entryFee > 0) {
    const order = await paymentProvider.createOrder({
      orderId,
      amount: tournament.entryFee,
      customerName: input.captainName,
      customerEmail: input.captainEmail,
      customerPhone: input.captainPhone,
    });
    paymentOrderId = order.providerOrderId;
  }

  try {
    return await TournamentRegistrationModel.create({
      orderId,
      tournamentId: tournament._id,
      vendorId: tournament.vendorId,
      customerId: input.customerId ?? null,
      teamName: input.teamName,
      captainName: input.captainName,
      captainPhone: input.captainPhone,
      captainEmail: input.captainEmail,
      players: input.players,
      amount: tournament.entryFee,
      payment: input.payment,
      paymentOrderId,
      paymentStatus: tournament.entryFee > 0 ? "pending" : "paid",
      status: "Registered",
    });
  } catch (err) {
    // Registration write failed after the count was claimed — release the slot rather than strand it.
    await TournamentModel.updateOne({ _id: tournament._id }, { $inc: { registeredTeamsCount: -1 } });
    throw err;
  }
}

export async function getRegistrationByOrderId(orderId: string, scope?: { customerId?: string; vendorId?: string }) {
  const filter: FilterQuery<TournamentRegistrationDocument> = { orderId };
  if (scope?.customerId) filter.customerId = scope.customerId;
  if (scope?.vendorId) filter.vendorId = scope.vendorId;

  const registration = await TournamentRegistrationModel.findOne(filter);
  if (!registration) throw ApiError.notFound("Registration not found");
  return registration;
}

export async function listMyRegistrations(customerId: string, filters: { status?: string; page: number; limit: number }) {
  const filter: FilterQuery<TournamentRegistrationDocument> = { customerId };
  if (filters.status) filter.status = filters.status;
  return paginateRegistrations(filter, filters);
}

export async function listRegistrationsForVendor(
  vendorId: string,
  filters: { status?: string; tournamentId?: string; page: number; limit: number }
) {
  const filter: FilterQuery<TournamentRegistrationDocument> = { vendorId };
  if (filters.status) filter.status = filters.status;
  if (filters.tournamentId) filter.tournamentId = filters.tournamentId;
  return paginateRegistrations(filter, filters);
}

async function paginateRegistrations(
  filter: FilterQuery<TournamentRegistrationDocument>,
  { page, limit }: { page: number; limit: number }
) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    TournamentRegistrationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TournamentRegistrationModel.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function cancelMyRegistration(orderId: string, customerId: string, reason?: string) {
  const registration = await getRegistrationByOrderId(orderId, { customerId });
  if (registration.status !== "Registered") {
    throw ApiError.badRequest("This registration is not active");
  }
  registration.status = "Cancelled";
  registration.cancellationReason = reason;
  await registration.save();

  await TournamentModel.updateOne({ _id: registration.tournamentId }, { $inc: { registeredTeamsCount: -1 } });

  return registration;
}

export async function checkInRegistration(orderId: string, vendorId: string) {
  const registration = await getRegistrationByOrderId(orderId, { vendorId });

  if (registration.status === "Cancelled") {
    throw ApiError.badRequest("This registration was cancelled and cannot be checked in");
  }
  if (registration.checkedIn) {
    return { registration, alreadyCheckedIn: true };
  }

  registration.checkedIn = true;
  registration.checkedInAt = new Date();
  await registration.save();
  return { registration, alreadyCheckedIn: false };
}

export interface AddFixtureInput {
  round: string;
  teamAId: string;
  teamBId: string;
  scheduledAt: Date;
}

export async function addFixture(vendorId: string, tournamentId: string, input: AddFixtureInput) {
  const tournament = await getTournamentForVendor(vendorId, tournamentId);

  const [teamA, teamB] = await Promise.all([
    TournamentRegistrationModel.findOne({ _id: input.teamAId, tournamentId, status: "Registered" }),
    TournamentRegistrationModel.findOne({ _id: input.teamBId, tournamentId, status: "Registered" }),
  ]);
  if (!teamA || !teamB) throw ApiError.badRequest("Both teams must be registered for this tournament");

  const fixture: TournamentFixture = {
    id: uuidv4(),
    round: input.round,
    teamAId: teamA._id,
    teamBId: teamB._id,
    scheduledAt: input.scheduledAt,
    status: "Scheduled",
  };
  tournament.fixtures.push(fixture);
  await tournament.save();
  return tournament;
}

export interface UpdateFixtureResultInput {
  teamAScore: number;
  teamBScore: number;
  winnerTeamId?: string;
}

export async function updateFixtureResult(
  vendorId: string,
  tournamentId: string,
  fixtureId: string,
  input: UpdateFixtureResultInput
) {
  const tournament = await getTournamentForVendor(vendorId, tournamentId);
  const fixture = tournament.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) throw ApiError.notFound("Fixture not found");

  fixture.teamAScore = input.teamAScore;
  fixture.teamBScore = input.teamBScore;
  fixture.winnerTeamId = input.winnerTeamId ? new Types.ObjectId(input.winnerTeamId) : undefined;
  fixture.status = "Completed";

  await tournament.save();
  return tournament;
}
