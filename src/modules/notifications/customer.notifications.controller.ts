import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import {
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../services/notification.service";

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.auth?.sub;
  const phone = (req.query.phone as string) || (req.headers["x-player-phone"] as string);

  const notifications = await listNotificationsForUser(customerId, phone);
  sendSuccess(res, 200, notifications);
});

export const markMyNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.auth?.sub;
  const phone = (req.query.phone as string) || (req.headers["x-player-phone"] as string);
  const notificationId = req.params.id!;

  const notif = await markNotificationAsRead(notificationId, customerId, phone);
  sendSuccess(res, 200, notif, "Notification marked as read");
});

export const markAllMyNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const customerId = req.auth?.sub;
  const phone = (req.query.phone as string) || (req.headers["x-player-phone"] as string);

  const count = await markAllNotificationsAsRead(customerId, phone);
  sendSuccess(res, 200, { count }, "All notifications marked as read");
});
