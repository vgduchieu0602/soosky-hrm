import mongoose from 'mongoose';
import { eventBus } from '@infra/events/event-bus';
import { auditService } from '@features/iam';
import type { Clock, AuditPort, EventsPort, UnitOfWork, Tx } from '@features/attendance/domain/ports';

// Domain events emitted by the attendance/leave use-cases.
declare module '@infra/events/event-bus' {
  interface AppEventMap {
    'leave.submitted': { leaveRequestId: string; employeeId: string };
    'leave.decided': { leaveRequestId: string; employeeId: string; approved: boolean; reason?: string };
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class AuditServiceAdapter implements AuditPort {
  record(entry: {
    userId: string; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    return auditService.record(entry as Parameters<typeof auditService.record>[0]);
  }
}

export class EventBusAdapter implements EventsPort {
  leaveSubmitted(p: { leaveRequestId: string; employeeId: string }): void {
    eventBus.emit('leave.submitted', p);
  }
  leaveDecided(p: { leaveRequestId: string; employeeId: string; approved: boolean; reason?: string }): void {
    eventBus.emit('leave.decided', p);
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
