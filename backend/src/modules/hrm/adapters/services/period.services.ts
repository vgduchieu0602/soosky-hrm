import { eventBus } from '@infra/events/event-bus';
import { auditService } from '@modules/iam';
import type { AuditPort, EventsPort } from '@modules/hrm/core/period/domain/ports';

declare module '@infra/events/event-bus' {
  interface AppEventMap {
    'period.attendance-locked': { periodId: string; periodName: string };
    'period.performance-locked': { periodId: string; periodName: string };
    'period.closed': { periodId: string; periodName: string };
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
    eventBus.emit('period.attendance-locked', p);
  }
  performanceLocked(p: { periodId: string; periodName: string }): void {
    eventBus.emit('period.performance-locked', p);
  }
  periodClosed(p: { periodId: string; periodName: string }): void {
    eventBus.emit('period.closed', p);
  }
}
