import type { Clock } from '@modules/hrm/core/dashboard/domain/ports';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
