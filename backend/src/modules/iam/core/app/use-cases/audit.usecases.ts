import { logger } from '@infra/logger/logger';
import type { AuditLogRepository } from '@modules/iam/core/app/ports';
import type { AuditAction } from '@modules/iam/adapters/persistence/audit-log.repository';

const log = logger.child({ feature: 'iam', module: 'audit' });

interface AuditInput {
  userId?: string | null;
  resource: string;
  action: AuditAction;
  resourceId?: string;
  changes?: Record<string, unknown>;
}

export class AuditUseCases {
  constructor(private readonly repo: AuditLogRepository) {}

  /**
   * Fire-and-log audit write. Failure to persist an audit row MUST NOT block
   * the user request — we log the error and move on.
   */
  async record(input: AuditInput): Promise<void> {
    try {
      await this.repo.create(input);
    } catch (err) {
      log.error({ err, input }, 'Failed to write audit log');
    }
  }

  list(filter: { resource?: string; action?: string; resourceId?: string; limit?: number } = {}) {
    return this.repo.list(filter);
  }
}
