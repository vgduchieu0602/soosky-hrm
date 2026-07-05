import cron from 'node-cron';
import { logger } from '@core/logger/logger';
import { TIMEZONE } from '@features/attendance/domain/attendance-calc';
import { employeeReminderService } from '@features/employee/container';

const log = logger.child({ feature: 'employee', module: 'reminder-job' });

export function runContractReminders(): Promise<{ notified: number }> {
  return employeeReminderService.runContractReminders();
}

/** Schedule daily reminder scans at 08:00 (Asia/Ho_Chi_Minh). */
export function registerReminderJobs(): void {
  cron.schedule('0 8 * * *', () => {
    runContractReminders().catch((err) => log.error({ err }, 'contract reminder job failed'));
  }, { timezone: TIMEZONE });
  log.info('reminder jobs scheduled (daily 08:00 ICT)');
}
