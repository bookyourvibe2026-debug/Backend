import { Schema, model, Types } from "mongoose";

export type ChallengeStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";
export type ChallengePlayersCount = "1v1" | "2v2" | "team";
export type ChallengeSeries = "BO1" | "BO3" | "BO5";
export type ChallengeMatchStyle = "friendly" | "competitive" | "tournament";
export type ChallengeStakeType = "Treat" | "Movie" | "Cash" | "Trophy" | "Apology Post" | "Reel" | "Custom";

export interface ChallengeTeamMember {
  name: string;
  phone?: string;
  customerId?: Types.ObjectId | null;
}

export interface ChallengeDocument {
  _id: Types.ObjectId;
  code: string;
  challengerId: Types.ObjectId;
  opponentId?: Types.ObjectId | null;
  opponentName: string;
  opponentPhone?: string;
  /** Full roster when the challenge is a team match — team1 always includes the challenger,
   * team2 always includes the opponent. Optional so plain 1v1 challenges stay lightweight. */
  team1Members?: ChallengeTeamMember[];
  team2Members?: ChallengeTeamMember[];
  sport: string;
  venueName: string;
  /** Set only when the venue was picked from real listings — lets that venue's vendor
   * verify + check in this challenge at the door via QR scan. */
  venueId?: Types.ObjectId | null;
  scheduleLabel: string;
  scheduledAt?: Date;
  playersCount: ChallengePlayersCount;
  series: ChallengeSeries;
  matchStyle: ChallengeMatchStyle;
  entryFee: number;
  stakeType: ChallengeStakeType;
  stakeText: string;
  status: ChallengeStatus;
  /** Set once the venue scans the challenge QR and confirms the players showed up. */
  arrived: boolean;
  arrivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const teamMemberSchema = new Schema<ChallengeTeamMember>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
  },
  { _id: false }
);

const challengeSchema = new Schema<ChallengeDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    challengerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    opponentId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    opponentName: { type: String, required: true, trim: true, maxlength: 120 },
    opponentPhone: { type: String, trim: true },
    team1Members: { type: [teamMemberSchema], default: undefined },
    team2Members: { type: [teamMemberSchema], default: undefined },
    sport: { type: String, required: true, trim: true, maxlength: 60 },
    venueName: { type: String, required: true, trim: true, maxlength: 160 },
    venueId: { type: Schema.Types.ObjectId, ref: "Listing", default: null, index: true },
    scheduleLabel: { type: String, required: true, trim: true, maxlength: 120 },
    scheduledAt: { type: Date },
    playersCount: { type: String, enum: ["1v1", "2v2", "team"], default: "1v1" },
    series: { type: String, enum: ["BO1", "BO3", "BO5"], default: "BO1" },
    matchStyle: { type: String, enum: ["friendly", "competitive", "tournament"], default: "competitive" },
    entryFee: { type: Number, default: 0, min: 0 },
    stakeType: {
      type: String,
      enum: ["Treat", "Movie", "Cash", "Trophy", "Apology Post", "Reel", "Custom"],
      default: "Custom",
    },
    stakeText: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "completed"],
      default: "pending",
    },
    arrived: { type: Boolean, default: false },
    arrivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ChallengeModel = model<ChallengeDocument>("Challenge", challengeSchema);
