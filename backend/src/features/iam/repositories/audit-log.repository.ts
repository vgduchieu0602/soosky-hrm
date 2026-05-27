import { Types } from 'mongoose';
import { AuditLog } from '@shared/models/audit-log.model';

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

interface CreateAuditInput {
  userId?: string | null;
  resource: string;
  action: AuditAction;
  resourceId?: string;
  changes?: Record<string, unknown>;
}

export const auditLogRepository = {
  create(input: CreateAuditInput) {
    return AuditLog.create({
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      resource: input.resource,
      action: input.action,
      resourceId: input.resourceId ? new Types.ObjectId(input.resourceId) : undefined,
      changes: input.changes,
      timestamp: new Date(),
    });
  },
};
