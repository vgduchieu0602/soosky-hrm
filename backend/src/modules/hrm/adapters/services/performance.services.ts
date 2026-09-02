import { eventBus } from '@infra/events/event-bus';
import { auditService } from '@features/iam';
import type { Clock, AuditPort, EventsPort } from '@modules/hrm/core/performance/domain/ports';

// Domain events emitted by the performance/evaluation use-cases.
declare module '@infra/events/event-bus' {
  interface AppEventMap {
    'evaluation.finalized': { employeeId: string; payrollPeriodId: string };
    'evaluation.reopened': { employeeId: string };
    'evaluation.disputed': { employeeId: string; evaluationId: string };
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
  evaluationFinalized(p: { employeeId: string; payrollPeriodId: string }): void {
    eventBus.emit('evaluation.finalized', p);
  }
  evaluationReopened(p: { employeeId: string }): void {
    eventBus.emit('evaluation.reopened', p);
  }
  evaluationDisputed(p: { employeeId: string; evaluationId: string }): void {
    eventBus.emit('evaluation.disputed', p);
  }
}
