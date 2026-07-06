import type {
  Id,
  LoggerPort,
  NewNotification,
  NotificationRepository,
  NotificationSeverity,
  NotificationType,
  RoleGateway,
} from '@features/notification/domain/ports';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  severity?: NotificationSeverity;
}

/**
 * Core notification use-cases. Also the cross-feature public service
 * (`notificationService`): `notify`, `notifyMany`, `userIdsByRoles` are called
 * by other features. `notify`/`notifyMany` are fire-and-forget — they never
 * throw into the caller.
 */
export class NotificationUseCases {
  constructor(
    private readonly repo: NotificationRepository,
    private readonly roles: RoleGateway,
    private readonly log: LoggerPort,
  ) {}

  private static toPayload(input: Omit<NotifyInput, 'userId'>): NewNotification {
    return {
      type: input.type,
      severity: input.severity ?? 'info',
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    };
  }

  /** Create one notification. Fire-and-forget: never throws into the caller. */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.repo.create(input.userId, NotificationUseCases.toPayload(input));
    } catch (err) {
      this.log.error({ err, input }, 'failed to create notification');
    }
  }

  /** Create the same notification for many recipients (deduped). */
  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
    try {
      const ids = [...new Set(userIds)];
      if (ids.length === 0) return;
      await this.repo.insertMany(ids, NotificationUseCases.toPayload(input));
    } catch (err) {
      this.log.error({ err, count: userIds.length }, 'failed to create notifications');
    }
  }

  /** User ids holding any of the given role names (for HR/admin fan-out). */
  userIdsByRoles(roleNames: string[]): Promise<string[]> {
    return this.roles.userIdsByRoles(roleNames);
  }

  listMine(userId: Id, opts: { unreadOnly?: boolean; limit?: number } = {}): Promise<unknown[]> {
    const limit = Math.min(opts.limit ?? 30, 100);
    return this.repo.listMine(userId, { unreadOnly: opts.unreadOnly ?? false, limit });
  }

  unreadCount(userId: Id): Promise<number> {
    return this.repo.unreadCount(userId);
  }

  async markRead(id: Id, userId: Id): Promise<{ ok: boolean }> {
    const ok = await this.repo.markRead(id, userId);
    return { ok };
  }

  async markAllRead(userId: Id): Promise<{ updated: number }> {
    const updated = await this.repo.markAllRead(userId);
    return { updated };
  }
}
