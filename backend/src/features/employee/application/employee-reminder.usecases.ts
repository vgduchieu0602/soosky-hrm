import { logger } from '@infra/logger/logger';
import {
  classifyReminders,
  REMINDER_THRESHOLDS,
  type ReminderItem,
} from '@features/employee/domain/employee-rules';
import type { ReminderRepository, NotificationGateway, Clock } from '@features/employee/domain/ports';

export type { ReminderItem };

const log = logger.child({ feature: 'employee', module: 'reminder' });

export class EmployeeReminderUseCases {
  constructor(
    private readonly repo: ReminderRepository,
    private readonly notifications: NotificationGateway,
    private readonly clock: Clock,
  ) {}

  async expiring(withinDays = 30): Promise<{ probation: ReminderItem[]; contract: ReminderItem[] }> {
    const now = this.clock.now();
    const rows = await this.repo.expiring(withinDays, now);
    return classifyReminders(rows, now);
  }

  async runContractReminders(): Promise<{ notified: number }> {
    const { probation, contract } = await this.expiring(30);
    const due = [...probation, ...contract].filter((i) => REMINDER_THRESHOLDS.has(i.daysLeft));
    if (due.length === 0) return { notified: 0 };

    const recipients = await this.notifications.userIdsByRoles(['admin', 'hr_manager']);
    if (recipients.length === 0) return { notified: 0 };

    for (const item of due) {
      const isProbation = item.employmentStatus === 'probation' || item.employmentStatus === 'internship';
      await this.notifications.notifyMany(recipients, {
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
}
