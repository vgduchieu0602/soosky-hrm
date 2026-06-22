import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import {
  Notification,
  type NotificationSeverity,
  type NotificationType,
} from '@shared/models/notification.model';
import { Role } from '@shared/models/role.model';
import { UserRole } from '@shared/models/user-role.model';

const log = logger.child({ feature: 'notification' });

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  severity?: NotificationSeverity;
}

export const notificationService = {
  /** Create one notification. Fire-and-forget: never throws into the caller. */
  async notify(input: NotifyInput): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(input.userId)) return;
      await Notification.create({
        userId: new Types.ObjectId(input.userId),
        type: input.type,
        severity: input.severity ?? 'info',
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      });
    } catch (err) {
      log.error({ err, input }, 'failed to create notification');
    }
  },

  /** Create the same notification for many recipients (deduped). */
  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
    try {
      const ids = [...new Set(userIds)].filter((id) => Types.ObjectId.isValid(id));
      if (ids.length === 0) return;
      await Notification.insertMany(
        ids.map((id) => ({
          userId: new Types.ObjectId(id),
          type: input.type,
          severity: input.severity ?? 'info',
          title: input.title,
          message: input.message,
          link: input.link ?? null,
        })),
      );
    } catch (err) {
      log.error({ err, count: userIds.length }, 'failed to create notifications');
    }
  },

  /** User ids holding any of the given role names (for HR/admin fan-out). */
  async userIdsByRoles(roleNames: string[]): Promise<string[]> {
    const roles = await Role.find({ name: { $in: roleNames } }).select('_id').lean();
    if (roles.length === 0) return [];
    const links = await UserRole.find({ roleId: { $in: roles.map((r) => r._id) } })
      .select('userId')
      .lean();
    return [...new Set(links.map((l) => String(l.userId)))];
  },

  listMine(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (opts.unreadOnly) filter.read = false;
    const limit = Math.min(opts.limit ?? 30, 100);
    return Notification.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  },

  unreadCount(userId: string) {
    return Notification.countDocuments({ userId: new Types.ObjectId(userId), read: false });
  },

  async markRead(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) return { ok: false };
    await Notification.updateOne(
      { _id: id, userId: new Types.ObjectId(userId) },
      { $set: { read: true, readAt: new Date() } },
    );
    return { ok: true };
  },

  async markAllRead(userId: string) {
    const res = await Notification.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return { updated: res.modifiedCount };
  },
};
