import { Types } from 'mongoose';
import { AuditLog } from '@shared/models/audit-log.model';
import type { AuditLogRepository } from '@features/iam/domain/ports';

export type AuditAction =
  | 'login'
  | 'login-failed'
  | 'login-blocked'
  | 'logout'
  | 'refresh'
  | 'session-reuse'
  | 'create'
  | 'update'
  | 'delete';

export class MongooseAuditLogRepository implements AuditLogRepository {
  async create(input: {
    userId?: string | null; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    await AuditLog.create({
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      resource: input.resource,
      action: input.action,
      resourceId: input.resourceId ? new Types.ObjectId(input.resourceId) : undefined,
      changes: input.changes,
      timestamp: new Date(),
    });
  }

  list(filter: { resource?: string; action?: string; resourceId?: string; limit?: number } = {}) {
    const query: Record<string, unknown> = {};
    if (filter.resource) query.resource = filter.resource;
    if (filter.action) query.action = filter.action;
    if (filter.resourceId && Types.ObjectId.isValid(filter.resourceId)) {
      query.resourceId = new Types.ObjectId(filter.resourceId);
    }
    const limit = Math.min(filter.limit ?? 100, 500);
    return AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate({ path: 'userId', select: 'username email' })
      .lean();
  }
}
