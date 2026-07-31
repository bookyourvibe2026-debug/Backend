import { Types } from "mongoose";
import { NotificationModel, NotificationType, NotificationDocument } from "../models/Notification.model";

export interface CreateNotificationInput {
  recipientCustomerId?: string | Types.ObjectId | null;
  recipientPhone?: string;
  title: string;
  message: string;
  type: NotificationType;
  matchId?: string;
  participantId?: string;
  actionUrl?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationDocument> {
  return NotificationModel.create({
    recipientCustomerId: input.recipientCustomerId ? new Types.ObjectId(input.recipientCustomerId) : null,
    recipientPhone: input.recipientPhone,
    title: input.title,
    message: input.message,
    type: input.type,
    matchId: input.matchId,
    participantId: input.participantId,
    actionUrl: input.actionUrl,
  });
}

export async function listNotificationsForUser(
  customerId?: string,
  phone?: string,
  limit = 20
): Promise<NotificationDocument[]> {
  const conditions: any[] = [];
  if (customerId) conditions.push({ recipientCustomerId: customerId });
  if (phone) conditions.push({ recipientPhone: phone });

  if (conditions.length === 0) return [];

  return NotificationModel.find({ $or: conditions })
    .sort({ createdAt: -1 })
    .limit(limit);
}

export async function markNotificationAsRead(
  notificationId: string,
  customerId?: string,
  phone?: string
): Promise<NotificationDocument | null> {
  const conditions: any[] = [];
  if (customerId) conditions.push({ recipientCustomerId: customerId });
  if (phone) conditions.push({ recipientPhone: phone });

  const query: any = { _id: notificationId };
  if (conditions.length > 0) query.$or = conditions;

  const notif = await NotificationModel.findOne(query);
  if (!notif) return null;

  notif.read = true;
  await notif.save();
  return notif;
}

export async function markAllNotificationsAsRead(
  customerId?: string,
  phone?: string
): Promise<number> {
  const conditions: any[] = [];
  if (customerId) conditions.push({ recipientCustomerId: customerId });
  if (phone) conditions.push({ recipientPhone: phone });

  if (conditions.length === 0) return 0;

  const res = await NotificationModel.updateMany({ $or: conditions, read: false }, { $set: { read: true } });
  return res.modifiedCount;
}
