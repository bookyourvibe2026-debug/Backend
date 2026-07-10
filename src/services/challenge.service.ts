import { Types } from "mongoose";
import { CustomerDocument, CustomerModel } from "../models/Customer.model";
import { ChallengeDocument, ChallengeModel } from "../models/Challenge.model";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

const DEFAULT_INVITE_BASE_URL = env.corsOrigins[0] ?? "https://bookyourvibe.in";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `CHAL${suffix}`;
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateCode();
    const exists = await ChallengeModel.exists({ code });
    if (!exists) return code;
  }
  throw ApiError.internal("Could not generate a unique challenge code");
}

type CustomerLite = Pick<CustomerDocument, "_id" | "name" | "phone" | "avatarUrl">;

function buildChallengeResponse(
  doc: ChallengeDocument,
  challenger: CustomerLite | null,
  opponent: CustomerLite | null,
  inviteBaseUrl: string
) {
  const base = (inviteBaseUrl || DEFAULT_INVITE_BASE_URL).replace(/\/$/, "");
  const inviteUrl = `${base}/challenge/${doc.code}`;
  const challengerName = challenger?.name ?? "BYV Player";
  const opponentName = opponent?.name ?? doc.opponentName;

  const shareMessage = [
    "You've been challenged!",
    `${challengerName} has challenged ${opponentName} for a ${doc.sport}.`,
    `Venue: ${doc.venueName}`,
    `Time: ${doc.scheduleLabel}`,
    `Bet: Loser buys ${doc.stakeText}`,
    inviteUrl,
  ].join("\n");

  return {
    id: doc._id.toString(),
    code: doc.code,
    challenger: challenger
      ? { id: challenger._id.toString(), name: challenger.name, phone: challenger.phone, avatarUrl: challenger.avatarUrl }
      : null,
    opponent: {
      id: opponent?._id?.toString(),
      name: opponentName,
      phone: opponent?.phone ?? doc.opponentPhone,
      avatarUrl: opponent?.avatarUrl,
    },
    sport: doc.sport,
    venueName: doc.venueName,
    scheduleLabel: doc.scheduleLabel,
    scheduledAt: doc.scheduledAt?.toISOString(),
    playersCount: doc.playersCount,
    series: doc.series,
    matchStyle: doc.matchStyle,
    entryFee: doc.entryFee,
    stakeType: doc.stakeType,
    stakeText: doc.stakeText,
    inviteUrl,
    shareMessage,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    poster: {
      challengerInitials: initials(challengerName),
      opponentInitials: initials(opponentName),
    },
  };
}

/** Existing registered players a customer can challenge — same accounts used for the default login/booking flow. */
export async function listChallengePlayers(customerId: string, opts: { search?: string; limit: number }) {
  const filter: Record<string, unknown> = { _id: { $ne: new Types.ObjectId(customerId) }, status: "active" };
  if (opts.search) {
    const re = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { phone: re }, { email: re }];
  }
  const customers = await CustomerModel.find(filter)
    .select("name phone avatarUrl")
    .sort({ createdAt: -1 })
    .limit(opts.limit)
    .lean();

  return customers.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    phone: c.phone,
    avatarUrl: c.avatarUrl,
    initials: initials(c.name),
    relation: "Active Playpal",
  }));
}

export async function createChallenge(
  customerId: string,
  input: {
    opponentId?: string;
    opponentName?: string;
    opponentPhone?: string;
    sport: string;
    venueName: string;
    scheduleLabel: string;
    scheduledAt?: Date;
    playersCount: ChallengeDocument["playersCount"];
    series: ChallengeDocument["series"];
    matchStyle: ChallengeDocument["matchStyle"];
    entryFee: number;
    stakeType: ChallengeDocument["stakeType"];
    stakeText: string;
    inviteBaseUrl?: string;
  }
) {
  const challenger = await CustomerModel.findById(customerId).select("name phone avatarUrl");
  if (!challenger) throw ApiError.notFound("Customer not found");

  let opponent: CustomerLite | null = null;
  if (input.opponentId) {
    opponent = await CustomerModel.findById(input.opponentId).select("name phone avatarUrl");
    if (!opponent) throw ApiError.notFound("Opponent not found");
  }

  const opponentName = opponent?.name ?? input.opponentName;
  if (!opponentName) throw ApiError.badRequest("Either opponentId or opponentName is required");

  const code = await uniqueCode();
  const doc = await ChallengeModel.create({
    code,
    challengerId: challenger._id,
    opponentId: opponent?._id ?? null,
    opponentName,
    opponentPhone: input.opponentPhone,
    sport: input.sport,
    venueName: input.venueName,
    scheduleLabel: input.scheduleLabel,
    scheduledAt: input.scheduledAt,
    playersCount: input.playersCount,
    series: input.series,
    matchStyle: input.matchStyle,
    entryFee: input.entryFee,
    stakeType: input.stakeType,
    stakeText: input.stakeText,
    status: "pending",
  });

  return buildChallengeResponse(doc, challenger, opponent, input.inviteBaseUrl ?? DEFAULT_INVITE_BASE_URL);
}

export async function getChallengeByCode(code: string) {
  const doc = await ChallengeModel.findOne({ code: code.toUpperCase() });
  if (!doc) throw ApiError.notFound("Challenge not found");
  const [challenger, opponent] = await Promise.all([
    CustomerModel.findById(doc.challengerId).select("name phone avatarUrl"),
    doc.opponentId ? CustomerModel.findById(doc.opponentId).select("name phone avatarUrl") : null,
  ]);
  return buildChallengeResponse(doc, challenger, opponent, DEFAULT_INVITE_BASE_URL);
}

export async function acceptChallenge(code: string, customerId: string) {
  const doc = await ChallengeModel.findOne({ code: code.toUpperCase() });
  if (!doc) throw ApiError.notFound("Challenge not found");
  if (doc.status !== "pending") throw ApiError.conflict("This challenge is no longer pending");
  if (doc.challengerId.toString() === customerId) throw ApiError.badRequest("You can't accept your own challenge");

  if (!doc.opponentId) doc.opponentId = new Types.ObjectId(customerId);
  doc.status = "accepted";
  await doc.save();

  const [challenger, opponent] = await Promise.all([
    CustomerModel.findById(doc.challengerId).select("name phone avatarUrl"),
    CustomerModel.findById(doc.opponentId).select("name phone avatarUrl"),
  ]);
  return buildChallengeResponse(doc, challenger, opponent, DEFAULT_INVITE_BASE_URL);
}

export async function rejectChallenge(code: string, customerId: string) {
  const doc = await ChallengeModel.findOne({ code: code.toUpperCase() });
  if (!doc) throw ApiError.notFound("Challenge not found");
  if (doc.status !== "pending") throw ApiError.conflict("This challenge is no longer pending");
  if (doc.challengerId.toString() !== customerId && doc.opponentId?.toString() !== customerId) {
    throw ApiError.forbidden("You are not part of this challenge");
  }

  doc.status = "rejected";
  await doc.save();

  const [challenger, opponent] = await Promise.all([
    CustomerModel.findById(doc.challengerId).select("name phone avatarUrl"),
    doc.opponentId ? CustomerModel.findById(doc.opponentId).select("name phone avatarUrl") : null,
  ]);
  return buildChallengeResponse(doc, challenger, opponent, DEFAULT_INVITE_BASE_URL);
}
