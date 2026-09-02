import { Types } from 'mongoose';
import { Notification } from '@modules/hrm/adapters/persistence/mongoose/models/notification.model';
import type { Id, NewNotification, NotificationRepository } from '@modules/hrm/core/notification/domain/ports';

export class MongooseNotificationRepository implements NotificationRepository {
  async create(userId: Id, data: NewNotification): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await Notification.create({
      userId: new Types.ObjectId(userId),
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      link: data.link,
    });
  }

  async insertMany(userIds: Id[], data: NewNotification): Promise<void> {
    const ids = userIds.filter((id) => Types.ObjectId.isValid(id));
    if (ids.length === 0) return;
    await Notification.insertMany(
      ids.map((id) => ({
        userId: new Types.ObjectId(id),
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        link: data.link,
      })),
    );
  }

  listMine(userId: Id, opts: { unreadOnly: boolean; limit: number }): Promise<unknown[]> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (opts.unreadOnly) filter.read = false;
    return Notification.find(filter).sort({ created_at: -1 }).limit(opts.limit).lean();
  }

  unreadCount(userId: Id): Promise<number> {
    return Notification.countDocuments({ userId: new Types.ObjectId(userId), read: false });
  }

  async markRead(id: Id, userId: Id): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    await Notification.updateOne(
      { _id: id, userId: new Types.ObjectId(userId) },
      { $set: { read: true, readAt: new Date() } },
    );
    return true;
  }

  async markAllRead(userId: Id): Promise<number> {
    const res = await Notification.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    return res.modifiedCount;
  }
}
