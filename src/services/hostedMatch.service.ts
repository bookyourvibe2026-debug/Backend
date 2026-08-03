import { FilterQuery, Types } from "mongoose";
import { HostedMatchDocument, HostedMatchModel, HostedMatchParticipant } from "../models/HostedMatch.model";
import { ListingModel, Court } from "../models/Listing.model";
import { CustomerModel } from "../models/Customer.model";
import { BookingModel } from "../models/Booking.model";
import { paymentProvider } from "./payment/payment.service";
import { ApiError } from "../utils/ApiError";
import { activeBoostPct, boostedPrice } from "./lastMinBoost.service";
import { istTimeHHmm, timeToMinutes, computePricing, IST } from "./booking.service";

export interface CreateHostedMatchInput {
  listingId: string;
  sport: string;
  dateTime: string;
  durationMinutes?: number;
  courtId?: string;
  pricingType: "host_pays_all" | "split_cost";
  entryFeePerPlayer?: number;
  maxPlayers: number;
  hostName?: string;
  hostPhone?: string;
  hostEmail?: string;
}

function generateMatchId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `HM-${suffix}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const aE = aEnd <= aStart ? aEnd + 1440 : aEnd;
  const bE = bEnd <= bStart ? bEnd + 1440 : bEnd;
  return aStart < bE && bStart < aE;
}

export async function createHostedMatch(
  hostCustomerId: string,
  input: CreateHostedMatchInput
): Promise<HostedMatchDocument> {
  const customer = await CustomerModel.findById(hostCustomerId);
  if (!customer) throw ApiError.notFound("Host customer profile not found");

  const listing = await ListingModel.findOne({ _id: input.listingId, status: "Active", isPrivate: false });
  if (!listing) throw ApiError.notFound("Listing not found or unavailable");

  const hostName = input.hostName || customer.name || "Match Host";
  const hostPhone = input.hostPhone || customer.phone;
  if (!hostPhone) throw ApiError.badRequest("Mobile number is required to host a match");

  const bDate = new Date(input.dateTime);
  const dateStr = bDate.toLocaleDateString("en-CA", { timeZone: IST });
  const startTime = istTimeHHmm(bDate);
  const durationMin = input.durationMinutes || 60;
  const endTime = istTimeHHmm(new Date(bDate.getTime() + durationMin * 60_000));

  // Compute Turf Pricing for the selected slot & duration
  let baseAmount = listing.price || 1000;
  let selectedCourt: Court | undefined;

  if (listing.type === "Turf") {
    const startMin = timeToMinutes(startTime);
    const endMin = startMin + durationMin;
    const slots = listing.slotsList || [];

    if (slots.length > 0) {
      let coveredMin = 0;
      let weightedSum = 0;
      for (const s of slots) {
        const sStart = timeToMinutes(s.startTime);
        let sEnd = timeToMinutes(s.endTime);
        if (sEnd <= sStart) sEnd += 1440;
        const overlap = Math.min(endMin, sEnd) - Math.max(startMin, sStart);
        if (overlap > 0) {
          coveredMin += overlap;
          weightedSum += overlap * s.price;
        }
      }
      if (coveredMin > 0) {
        baseAmount = Math.round(weightedSum / coveredMin);
      }
    }

    if (input.courtId) {
      // The court only decides *which* unit is taken, never the rate — the time slot
      // price is the single source of truth across booking, hosting and the venue page.
      selectedCourt = (listing.courts ?? []).find((c) => c.id === input.courtId);
    }

    baseAmount = Math.round((durationMin / 60) * baseAmount);

    const nowIst = new Date();
    if (dateStr === nowIst.toLocaleDateString("en-CA", { timeZone: IST })) {
      const boostPct = activeBoostPct(
        listing.lastMinBoosts,
        startTime,
        timeToMinutes(istTimeHHmm(nowIst)),
        input.sport,
        selectedCourt?.id
      );
      if (boostPct > 0) baseAmount = boostedPrice(baseAmount, boostPct);
    }
  }

  const pricing = computePricing(baseAmount, 0);
  const totalTurfCost = pricing.totalAmount;

  let entryFee = 0;
  let hostPaidAmount = totalTurfCost;

  if (input.pricingType === "split_cost") {
    entryFee = Math.max(0, Math.round(input.entryFeePerPlayer || 0));
    if (entryFee <= 0) {
      throw ApiError.badRequest("Please set a valid entry fee per player for split cost match");
    }
    hostPaidAmount = entryFee;
  }

  const matchId = generateMatchId();

  // Create payment order for host
  const order = await paymentProvider.createOrder({
    orderId: matchId,
    amount: hostPaidAmount,
    customerName: hostName,
    customerEmail: input.hostEmail || customer.email || "host@byv.com",
    customerPhone: hostPhone,
  });

  const hostParticipant: HostedMatchParticipant = {
    participantId: `part-host-${Date.now()}`,
    customerId: customer._id,
    name: hostName,
    phone: hostPhone,
    email: customer.email,
    joinedAt: new Date(),
    status: "Confirmed",
    paymentStatus: "pending",
    amountPaid: hostPaidAmount,
  };

  return HostedMatchModel.create({
    matchId,
    listingId: listing._id,
    vendorId: listing.vendorId,
    hostCustomerId: customer._id,
    hostName,
    hostPhone,
    hostEmail: input.hostEmail || customer.email,
    sport: input.sport,
    date: dateStr,
    dateTime: bDate,
    startTime,
    endTime,
    durationMinutes: durationMin,
    courtId: selectedCourt?.id,
    courtName: selectedCourt?.name,
    pricingType: input.pricingType,
    totalTurfCost,
    hostPaidAmount,
    entryFeePerPlayer: entryFee,
    maxPlayers: input.maxPlayers,
    hostPaymentOrderId: order.providerOrderId,
    hostPaymentStatus: "pending",
    status: "Awaiting Host Payment",
    participants: [hostParticipant],
  });
}

export async function confirmHostPayment(
  matchId: string,
  hostCustomerId?: string
): Promise<HostedMatchDocument> {
  const filter: FilterQuery<HostedMatchDocument> = { matchId };
  if (hostCustomerId) filter.hostCustomerId = hostCustomerId;

  const match = await HostedMatchModel.findOne(filter);
  if (!match) throw ApiError.notFound("Hosted match not found");

  if (match.status === "Open for Joining" || match.status === "Full" || match.status === "Completed") {
    return match; // Already confirmed & open
  }

  if (match.hostPaymentOrderId) {
    await paymentProvider.verifyPayment(match.hostPaymentOrderId);
  }

  // Create underlying turf booking so the court slot is locked on the venue calendar
  const bookingOrderId = `BK-${match.matchId}`;
  const booking = await BookingModel.create({
    orderId: bookingOrderId,
    listingId: match.listingId,
    vendorId: match.vendorId,
    customerId: match.hostCustomerId,
    customerName: match.hostName,
    phone: match.hostPhone,
    email: match.hostEmail,
    sport: match.sport,
    courtId: match.courtId,
    courtName: match.courtName,
    dateTime: match.dateTime,
    endTime: match.endTime,
    totalAmount: match.totalTurfCost,
    paidAmount: match.hostPaidAmount,
    platformFee: 0,
    taxes: 0,
    vendorEarning: match.totalTurfCost,
    payment: "Cashfree (Online)",
    paymentOrderId: match.hostPaymentOrderId,
    paymentStatus: "paid",
    status: match.hostPaidAmount < match.totalTurfCost ? "Part Paid" : "Confirmed",
  });

  match.hostPaymentStatus = "paid";
  match.bookingId = booking._id;
  match.status = "Open for Joining";

  // Update host participant status
  if (match.participants.length > 0 && match.participants[0]) {
    match.participants[0].paymentStatus = "paid";
  }

  await match.save();
  await match.populate("listingId", "title coverImage address city type price");
  return match;
}

export async function listOpenHostedMatches(filters: { sport?: string; date?: string; limit?: number }) {
  // Only return public matches that are Open for Joining, not past their date/time, and active
  const query: FilterQuery<HostedMatchDocument> = {
    status: "Open for Joining",
    dateTime: { $gte: new Date(Date.now() - 3600_000) },
  };
  if (filters.sport) query.sport = filters.sport;
  if (filters.date) query.date = filters.date;

  const matches = await HostedMatchModel.find(query)
    .populate("listingId", "title coverImage address city type price")
    .sort({ dateTime: 1 })
    .limit(filters.limit || 30);

  return matches;
}

export async function getHostedMatchById(matchId: string): Promise<HostedMatchDocument> {
  const match = await HostedMatchModel.findOne({ matchId }).populate("listingId", "title coverImage address city type price");
  if (!match) throw ApiError.notFound("Match not found");
  return match;
}

import { createNotification, removeNotificationsForParticipant } from "./notification.service";

export async function requestToJoinMatch(
  matchId: string,
  player: { customerId?: string; name: string; phone?: string; email?: string }
): Promise<HostedMatchDocument> {
  const match = await HostedMatchModel.findOne({ matchId });
  if (!match) throw ApiError.notFound("Hosted match not found");

  if (match.status !== "Open for Joining") {
    throw ApiError.badRequest(`This match is currently ${match.status.toLowerCase()} and not accepting new players.`);
  }

  const confirmedCount = match.participants.filter((p) => p.status === "Confirmed").length;
  if (confirmedCount >= match.maxPlayers) {
    throw ApiError.badRequest("This match has reached its maximum player capacity.");
  }

  // Check if player already requested or joined
  const existing = match.participants.find(
    (p) =>
      (player.customerId && p.customerId?.toString() === player.customerId) ||
      (player.phone && p.phone === player.phone)
  );

  if (existing) {
    if (existing.status === "Rejected") {
      throw ApiError.badRequest("Your join request for this match was declined by the host.");
    }
    return match; // Already joined or requested
  }

  const participantId = `part-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  match.participants.push({
    participantId,
    customerId: player.customerId ? new Types.ObjectId(player.customerId) : null,
    name: player.name,
    phone: player.phone,
    email: player.email,
    joinedAt: new Date(),
    status: "Pending Approval",
    paymentStatus: "pending",
    amountPaid: 0,
  });

  await match.save();
  await match.populate("listingId", "title coverImage address city type price");

  const turfTitle = typeof match.listingId === "object" ? (match.listingId as any).title : "Sports Venue";

  // Send real-time notification to the host with full request metadata
  await createNotification({
    recipientCustomerId: match.hostCustomerId,
    recipientPhone: match.hostPhone,
    title: "New Join Request",
    message: `${player.name} requested to join your ${match.sport} match on ${match.date}.`,
    type: "join_request",
    matchId: match.matchId,
    participantId,
    playerName: player.name,
    sport: match.sport,
    turfName: turfTitle,
    date: match.date,
    timeSlot: `${match.startTime} – ${match.endTime}`,
    entryFee: match.entryFeePerPlayer,
    actionUrl: "/community",
  }).catch(() => {});

  return match;
}

export async function respondToJoinRequest(
  matchId: string,
  hostCustomerId: string,
  participantId: string,
  action: "accept" | "reject"
): Promise<{ match: HostedMatchDocument; playerOrderId?: string }> {
  const match = await HostedMatchModel.findOne({ matchId });
  if (!match) throw ApiError.notFound("Hosted match not found");

  const participant = match.participants.find((p) => p.participantId === participantId);
  if (!participant) throw ApiError.notFound("Participant request not found");

  await match.populate("listingId", "title coverImage address city type price");
  const turfTitle = typeof match.listingId === "object" ? (match.listingId as any).title : "Sports Venue";

  // Automatically remove the host's pending "join_request" notification once responded to
  await removeNotificationsForParticipant(match.matchId, participant.participantId, ["join_request"]).catch(() => {});

  let playerOrderId: string | undefined;

  if (action === "reject") {
    participant.status = "Rejected";
    participant.paymentStatus = "failed";

    // Notify player that request was rejected
    await createNotification({
      recipientCustomerId: participant.customerId,
      recipientPhone: participant.phone,
      title: "Join Request Rejected",
      message: "Your request to join the match has been rejected by the host.",
      type: "request_rejected",
      matchId: match.matchId,
      participantId: participant.participantId,
      playerName: participant.name,
      sport: match.sport,
      turfName: turfTitle,
      date: match.date,
      timeSlot: `${match.startTime} – ${match.endTime}`,
      entryFee: match.entryFeePerPlayer,
      actionUrl: "/community",
    }).catch(() => {});
  } else if (action === "accept") {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes payment countdown
    participant.approvalExpiresAt = expiresAt;

    if (match.entryFeePerPlayer > 0) {
      participant.status = "Payment Pending";
      playerOrderId = `${match.matchId}-P${Date.now().toString().slice(-4)}`;
      const order = await paymentProvider.createOrder({
        orderId: playerOrderId,
        amount: match.entryFeePerPlayer,
        customerName: participant.name,
        customerEmail: participant.email || "player@byv.com",
        customerPhone: participant.phone || match.hostPhone,
      });
      participant.paymentOrderId = order.providerOrderId;

      // Notify player to complete payment
      await createNotification({
        recipientCustomerId: participant.customerId,
        recipientPhone: participant.phone,
        title: "Request Approved!",
        message: "Your request has been approved. Please complete your payment to confirm your booking.",
        type: "request_accepted",
        matchId: match.matchId,
        participantId: participant.participantId,
        playerName: participant.name,
        sport: match.sport,
        turfName: turfTitle,
        date: match.date,
        timeSlot: `${match.startTime} – ${match.endTime}`,
        entryFee: match.entryFeePerPlayer,
        expiresAt,
        actionUrl: "/community",
      }).catch(() => {});
    } else {
      participant.status = "Confirmed";
      participant.paymentStatus = "paid";
      participant.amountPaid = 0;

      const confirmedCount = match.participants.filter((p) => p.status === "Confirmed").length;
      if (confirmedCount >= match.maxPlayers) {
        match.status = "Full";
      }

      await createNotification({
        recipientCustomerId: participant.customerId,
        recipientPhone: participant.phone,
        title: "Booking Confirmed",
        message: "Your booking has been confirmed successfully.",
        type: "payment_confirmed",
        matchId: match.matchId,
        participantId: participant.participantId,
        playerName: participant.name,
        sport: match.sport,
        turfName: turfTitle,
        date: match.date,
        timeSlot: `${match.startTime} – ${match.endTime}`,
        entryFee: match.entryFeePerPlayer,
        actionUrl: "/community",
      }).catch(() => {});
    }
  }

  await match.save();
  return { match, playerOrderId };
}

export async function confirmPlayerPayment(
  matchId: string,
  participantId: string,
  customerId?: string
): Promise<HostedMatchDocument> {
  const match = await HostedMatchModel.findOne({ matchId });
  if (!match) throw ApiError.notFound("Hosted match not found");

  const participant = match.participants.find((p) => p.participantId === participantId);
  if (!participant) throw ApiError.notFound("Participant record not found");

  if (participant.status === "Confirmed" && participant.paymentStatus === "paid") {
    await match.populate("listingId", "title coverImage address city type price");
    return match;
  }

  // Verify 10-minute timer hasn't expired
  if (participant.approvalExpiresAt && participant.approvalExpiresAt < new Date()) {
    participant.status = "Cancelled";
    participant.paymentStatus = "failed";
    await match.save();
    throw ApiError.badRequest("Payment window expired (10 mins). Spot has been released.");
  }

  if (participant.paymentOrderId) {
    await paymentProvider.verifyPayment(participant.paymentOrderId);
  }

  participant.paymentStatus = "paid";
  participant.status = "Confirmed";
  participant.amountPaid = match.entryFeePerPlayer;

  const confirmedCount = match.participants.filter((p) => p.status === "Confirmed").length;
  if (confirmedCount >= match.maxPlayers) {
    match.status = "Full";
  }

  await match.save();
  await match.populate("listingId", "title coverImage address city type price");
  const turfTitle = typeof match.listingId === "object" ? (match.listingId as any).title : "Sports Venue";

  // Automatically remove the "request_accepted" payment notification from the player's notification list
  await removeNotificationsForParticipant(match.matchId, participant.participantId, ["request_accepted"]).catch(() => {});

  // Send targeted confirmation notifications to BOTH player and host
  await Promise.all([
    createNotification({
      recipientCustomerId: participant.customerId,
      recipientPhone: participant.phone,
      title: "Booking Confirmed",
      message: "Your booking has been confirmed successfully.",
      type: "payment_confirmed",
      matchId: match.matchId,
      participantId: participant.participantId,
      playerName: participant.name,
      sport: match.sport,
      turfName: turfTitle,
      date: match.date,
      timeSlot: `${match.startTime} – ${match.endTime}`,
      entryFee: match.entryFeePerPlayer,
      actionUrl: "/community",
    }),
    createNotification({
      recipientCustomerId: match.hostCustomerId,
      recipientPhone: match.hostPhone,
      title: "Player Joined Match",
      message: `${participant.name} has completed the payment and joined your match.`,
      type: "payment_confirmed",
      matchId: match.matchId,
      participantId: participant.participantId,
      playerName: participant.name,
      sport: match.sport,
      turfName: turfTitle,
      date: match.date,
      timeSlot: `${match.startTime} – ${match.endTime}`,
      entryFee: match.entryFeePerPlayer,
      actionUrl: "/community",
    }),
  ]).catch(() => {});

  return match;
}
