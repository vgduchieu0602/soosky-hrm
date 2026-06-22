import cron from 'node-cron';
import { logger } from '@core/logger/logger';
import { employeeReminderService } from '@features/employee/services/employee-reminder.service';
import { notificationService } from '@features/notification';

const log = logger.child({ feature: 'employee', module: 'reminder-job' });

// Notify only when the remaining days hit one of these marks, so a contract
// generates ~5 notifications over its window instead of one every single day.
const THRESHOLDS = new Set([30, 15, 7, 3, 1]);

export async function runContractReminders(): Promise<{ notified: number }> {
  const { probation, contract } = await employeeReminderService.expiring(30);
  const due = [...probation, ...contract].filter((i) => THRESHOLDS.has(i.daysLeft));
  if (due.length === 0) return { notified: 0 };

  const recipients = await notificationService.userIdsByRoles(['admin', 'hr_manager']);
  if (recipients.length === 0) return { notified: 0 };

  for (const item of due) {
    const isProbation = item.employmentStatus === 'probation' || item.employmentStatus === 'internship';
    await notificationService.notifyMany(recipients, {
      type: 'employee',
      severity: item.daysLeft <= 7 ? 'warning' : 'info',
      title: isProbation ? 'Thử việc/thực tập sắp kết thúc' : 'Hợp đồng sắp hết hạn',
      message: `${item.fullName} (${item.employeeCode}) — còn ${item.daysLeft} ngày (hết hạn ${item.endDate.slice(0, 10)}).`,
      link: '/employees',
    });
  }
  log.info({ due: due.length, recipients: recipients.length }, 'contract reminders dispatched');
  return { notified: due.length };
}

/** Schedule daily reminder scans at 08:00 (Asia/Ho_Chi_Minh). */
export function registerReminderJobs(): void {
  cron.schedule('0 8 * * *', () => {
    runContractReminders().catch((err) => log.error({ err }, 'contract reminder job failed'));
  }, { timezone: 'Asia/Ho_Chi_Minh' });
  log.info('reminder jobs scheduled (daily 08:00 ICT)');
}
