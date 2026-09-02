import mongoose, { Types } from 'mongoose';
import { auditService } from '@modules/iam';
import type {
  AuditPort,
  Clock,
  IdValidator,
  UnitOfWork,
  Tx,
} from '@modules/hrm/core/organization/domain/ports';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class ObjectIdValidator implements IdValidator {
  isValid(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }
}

export class AuditServiceAdapter implements AuditPort {
  record(entry: {
    userId: string;
    resource: string;
    action: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    return auditService.record(entry as Parameters<typeof auditService.record>[0]);
  }

  list(filter: { resource?: string; resourceId?: string }): Promise<unknown[]> {
    return auditService.list(filter) as unknown as Promise<unknown[]>;
  }
}

export class MongooseUnitOfWork implements UnitOfWork {
  async withTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
