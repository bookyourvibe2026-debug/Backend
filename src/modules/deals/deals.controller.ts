import { Request, Response } from "express";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { getActiveLastMinuteDeals } from "./deals.service";

/** Deliberately NOT cached — a deal must vanish the moment its slot is booked or a
 * vendor cancels the boost, and the client already polls this every ~8-10s. */
export const getLastMinuteDeals = asyncHandler(async (_req: Request, res: Response) => {
  const deals = await getActiveLastMinuteDeals();
  sendSuccess(res, 200, deals);
});
