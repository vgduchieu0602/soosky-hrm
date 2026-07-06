import type { Clock } from '@features/dashboard/domain/ports';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
