import { Schema, model, Types } from "mongoose";

export type ChallengeStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";
export type ChallengePlayersCount = "1v1" | "2v2" | "team";
export type ChallengeSeries = "BO1" | "BO3" | "BO5";
export type ChallengeMatchStyle = "friendly" | "competitive" | "tournament";
export type ChallengeStakeType =
  | "Pizza"
  | "Coffee"
  | "Burger"
  | "Movie"
  | "Cash"
  | "Trophy"
  | "Insta Story"
  | "Apology"
  | "Reel"
  | "Custom";

export interface ChallengeDocument {
  _id: Types.ObjectId;
  code: string;
  challengerId: Types.ObjectId;
  opponentId?: Types.ObjectId | null;
  opponentName: string;
  opponentPhone?: string;
  sport: string;
  venueName: string;
  scheduleLabel: string;
  scheduledAt?: Date;
  playersCount: ChallengePlayersCount;
  series: ChallengeSeries;
  matchStyle: ChallengeMatchStyle;
  entryFee: number;
  stakeType: ChallengeStakeType;
  stakeText: string;
  status: ChallengeStatus;
  createdAt: Date;
  updatedAt: Date;
}

const challengeSchema = new Schema<ChallengeDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    challengerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    opponentId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    opponentName: { type: String, required: true, trim: true, maxlength: 120 },
    opponentPhone: { type: String, trim: true },
    sport: { type: String, required: true, trim: true, maxlength: 60 },
    venueName: { type: String, required: true, trim: true, maxlength: 160 },
    scheduleLabel: { type: String, required: true, trim: true, maxlength: 120 },
    scheduledAt: { type: Date },
    playersCount: { type: String, enum: ["1v1", "2v2", "team"], default: "1v1" },
    series: { type: String, enum: ["BO1", "BO3", "BO5"], default: "BO1" },
    matchStyle: { type: String, enum: ["friendly", "competitive", "tournament"], default: "competitive" },
    entryFee: { type: Number, default: 0, min: 0 },
    stakeType: {
      type: String,
      enum: ["Pizza", "Coffee", "Burger", "Movie", "Cash", "Trophy", "Insta Story", "Apology", "Reel", "Custom"],
      default: "Custom",
    },
    stakeText: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const ChallengeModel = model<ChallengeDocument>("Challenge", challengeSchema);
