import { Router } from "express";
import { optionalAuth } from "../../middleware/auth.middleware";
import {
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "./customer.notifications.controller";

export const customerNotificationsRouter = Router();

customerNotificationsRouter.get("/", optionalAuth("customer"), getMyNotifications);
customerNotificationsRouter.patch("/:id/read", optionalAuth("customer"), markMyNotificationRead);
customerNotificationsRouter.post("/read-all", optionalAuth("customer"), markAllMyNotificationsRead);
