import type { EventsPort } from '@modules/hrm/core/period/domain/ports';

/** Default no-op events; real wiring (notification/emitter) is supplied by the app. */
export class NoopPeriodEvents implements EventsPort {
  attendanceLocked(): void {}
  performanceLocked(): void {}
  periodClosed(): void {}
}
