import { logger } from '@infra/logger/logger';
import type { LoggerPort } from '@modules/hrm/core/notification/domain/ports';

export class PinoLogger implements LoggerPort {
  private readonly log = logger.child({ feature: 'notification' });

  error(obj: unknown, msg: string): void {
    this.log.error(obj as Record<string, unknown>, msg);
  }

  info(msg: string): void {
    this.log.info(msg);
  }
}
