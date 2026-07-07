import { Schema, model, Types } from "mongoose";

export type TournamentStatus = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
export type FixtureStatus = "Scheduled" | "Completed";

export interface TournamentFixture {
  id: string;
  round: string;
  teamAId: Types.ObjectId;
  teamBId: Types.ObjectId;
  scheduledAt: Date;
  teamAScore?: number;
  teamBScore?: number;
  winnerTeamId?: Types.ObjectId;
  status: FixtureStatus;
}

export interface TournamentDocument {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
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
  registeredTeamsCount: number;
  status: TournamentStatus;
  fixtures: TournamentFixture[];
  createdAt: Date;
  updatedAt: Date;
}

const fixtureSchema = new Schema<TournamentFixture>(
  {
    id: { type: String, required: true },
    round: { type: String, required: true },
    teamAId: { type: Schema.Types.ObjectId, required: true },
    teamBId: { type: Schema.Types.ObjectId, required: true },
    scheduledAt: { type: Date, required: true },
    teamAScore: { type: Number, min: 0 },
    teamBScore: { type: Number, min: 0 },
    winnerTeamId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ["Scheduled", "Completed"], default: "Scheduled" },
  },
  { _id: false }
);

const tournamentSchema = new Schema<TournamentDocument>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true },
    subCategory: { type: String },
    description: { type: String, required: true },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true },
    address: { type: String, required: true },
    entryFee: { type: Number, required: true, min: 0 },
    prizeMoney: { type: Number, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },
    maxTeams: { type: Number, min: 1 },
    registeredTeamsCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["Upcoming", "Ongoing", "Completed", "Cancelled"], default: "Upcoming" },
    fixtures: { type: [fixtureSchema], default: [] },
  },
  { timestamps: true }
);

tournamentSchema.index({ vendorId: 1, status: 1 });
tournamentSchema.index({ category: 1, status: 1 });

export const TournamentModel = model<TournamentDocument>("Tournament", tournamentSchema);
