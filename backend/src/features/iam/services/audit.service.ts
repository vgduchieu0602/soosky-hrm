import { logger } from '@core/logger/logger';
import {
  auditLogRepository,
  type AuditAction,
} from '@features/iam/repositories/audit-log.repository';

const log = logger.child({ feature: 'iam', module: 'audit' });

interface AuditInput {
  userId?: string | null;
  resource: string;
  action: AuditAction;
  resourceId?: string;
  changes?: Record<string, unknown>;
}

export const auditService = {
  /**
   * Fire-and-log audit write. Failure to persist an audit row MUST NOT block
   * the user request — we log the error and move on.
   */
  async record(input: AuditInput): Promise<void> {
    try {
      await auditLogRepository.create(input);
    } catch (err) {
      log.error({ err, input }, 'Failed to write audit log');
    }
  },

  list(
    filter: { resource?: string; action?: string; resourceId?: string; limit?: number } = {},
  ) {
    return auditLogRepository.list(filter);
  },
};
