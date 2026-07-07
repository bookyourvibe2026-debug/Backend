import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  addFixture,
  checkInRegistration,
  createTournament,
  getTournamentForVendor,
  listRegistrationsForVendor,
  listTournamentsForVendor,
  updateFixtureResult,
  updateTournament,
} from "../../services/tournament.service";

export const getVendorTournaments = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const result = await listTournamentsForVendor(req.vendorId!, { status, page, limit });
  sendSuccess(res, 200, result);
});

export const getVendorTournamentById = asyncHandler(async (req: Request, res: Response) => {
  const tournament = await getTournamentForVendor(req.vendorId!, req.params.id!);
  sendSuccess(res, 200, tournament);
});

export const createVendorTournament = asyncHandler(async (req: Request, res: Response) => {
  const tournament = await createTournament(req.vendorId!, req.body);
  sendSuccess(res, 201, tournament, "Tournament created");
});

export const updateVendorTournament = asyncHandler(async (req: Request, res: Response) => {
  const tournament = await updateTournament(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 200, tournament, "Tournament updated");
});

export const addVendorTournamentFixture = asyncHandler(async (req: Request, res: Response) => {
  const tournament = await addFixture(req.vendorId!, req.params.id!, req.body);
  sendSuccess(res, 201, tournament, "Fixture added");
});

export const updateVendorTournamentFixtureResult = asyncHandler(async (req: Request, res: Response) => {
  const tournament = await updateFixtureResult(req.vendorId!, req.params.id!, req.params.fixtureId!, req.body);
  sendSuccess(res, 200, tournament, "Result recorded");
});

export const getVendorTournamentRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const { status, tournamentId, page, limit } = req.query as unknown as {
    status?: string;
    tournamentId?: string;
    page: number;
    limit: number;
  };
  const result = await listRegistrationsForVendor(req.vendorId!, { status, tournamentId, page, limit });
  sendSuccess(res, 200, result);
});

export const checkInVendorRegistration = asyncHandler(async (req: Request, res: Response) => {
  const { registration, alreadyCheckedIn } = await checkInRegistration(req.params.orderId!, req.vendorId!);
  sendSuccess(res, 200, registration, alreadyCheckedIn ? "Already checked in" : "Checked in");
});
