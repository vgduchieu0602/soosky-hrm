import mongoose from 'mongoose';
import { eventBus } from '@core/events/event-bus';
import { auditService } from '@features/iam/services/audit.service';
import type { Clock, AuditPort, EventsPort, UnitOfWork, Tx } from '@features/employee/domain/ports';

// Domain events emitted by the employee account/provisioning use-cases.
declare module '@core/events/event-bus' {
  interface AppEventMap {
    'employee.granted-login': { userId: string; employeeId: string; username: string; sendTo?: string };
    'employee.account.password-reset': { userId: string; employeeId: string; username: string; sendTo?: string };
    'employee.account.invite-resent': { userId: string; employeeId: string; username: string; sendTo?: string };
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
  grantedLogin(p: { userId: string; employeeId: string; username: string; sendTo?: string }): void {
    eventBus.emit('employee.granted-login', p);
  }
  passwordReset(p: { userId: string; employeeId: string; username: string; sendTo?: string }): void {
    eventBus.emit('employee.account.password-reset', p);
  }
  inviteResent(p: { userId: string; employeeId: string; username: string; sendTo?: string }): void {
    eventBus.emit('employee.account.invite-resent', p);
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
