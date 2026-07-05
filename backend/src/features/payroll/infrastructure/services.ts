import mongoose from 'mongoose';
import { eventBus } from '@core/events/event-bus';
import { auditService } from '@features/iam/services/audit.service';
import type { Clock, AuditPort, EventsPort, UnitOfWork, Tx } from '@features/payroll/domain/ports';

// Domain events emitted by the payroll use-cases.
declare module '@core/events/event-bus' {
  interface AppEventMap {
    'payroll.attendance-locked': { periodId: string; periodName: string };
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
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
}

export class EventBusAdapter implements EventsPort {
  attendanceLocked(p: { periodId: string; periodName: string }): void {
    eventBus.emit('payroll.attendance-locked', p);
  }
  payrollApproved(p: { periodId: string; count: number; approvedBy: string }): void {
    eventBus.emit('payroll.approved', p);
  }
  payrollPaid(p: { periodId: string; count: number; paidBy: string }): void {
    eventBus.emit('payroll.paid', p);
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
