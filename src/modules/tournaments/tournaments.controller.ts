import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getPublicTournamentById, listPublicTournaments } from "../../services/tournament.service";

export const browseTournaments = asyncHandler(async (req: Request, res: Response) => {
  const { category, city, status, page, limit } = req.query as unknown as {
    category?: string;
    city?: string;
    status?: string;
    page: number;
    limit: number;
  };

  const result = await listPublicTournaments({ category, city, status, page, limit });
  sendSuccess(res, 200, result);
});

export const getTournamentById = asyncHandler(async (req: Request, res: Response) => {
  const tournament = await getPublicTournamentById(req.params.id!);
  sendSuccess(res, 200, tournament);
});
