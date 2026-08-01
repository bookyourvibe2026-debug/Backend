import { Request, Response, NextFunction } from "express";
import { GamingSession } from "../../models/GamingSession.model";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

export async function getGamingSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = (req as any).vendor._id;
    const sessions = await GamingSession.find({ vendorId }).sort({ createdAt: -1 }).limit(50);
    return sendSuccess(res, 200, sessions, "Gaming sessions retrieved successfully");
  } catch (error) {
    next(error);
  }
}

export async function createGamingSession(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = (req as any).vendor._id;
    const { stationName, gameTitle, customerName, customerPhone, hourlyRate } = req.body;

    if (!stationName) {
      throw ApiError.badRequest("stationName is required");
    }

    const session = await GamingSession.create({
      vendorId,
      stationName,
      gameTitle,
      customerName,
      customerPhone,
      hourlyRate: hourlyRate || 200,
      startTime: new Date(),
      paymentStatus: "pending",
    });

    return sendSuccess(res, 201, session, "Gaming session started successfully");
  } catch (error) {
    next(error);
  }
}

export async function completeGamingSession(req: Request, res: Response, next: NextFunction) {
  try {
    const vendorId = (req as any).vendor._id;
    const { id } = req.params;

    const session = await GamingSession.findOne({ _id: id, vendorId });
    if (!session) {
      throw ApiError.notFound("Gaming session not found");
    }

    const endTime = new Date();
    const durationMinutes = Math.max(1, Math.round((endTime.getTime() - session.startTime.getTime()) / (1000 * 60)));
    const totalAmount = Math.round((durationMinutes / 60) * session.hourlyRate);

    session.endTime = endTime;
    session.durationMinutes = durationMinutes;
    session.totalAmount = totalAmount;
    session.paymentStatus = "completed";
    await session.save();

    return sendSuccess(res, 200, session, "Gaming session completed and billed successfully");
  } catch (error) {
    next(error);
  }
}
