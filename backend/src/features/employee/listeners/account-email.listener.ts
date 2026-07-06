import { Types } from 'mongoose';
import { eventBus } from '@core/events/event-bus';
import { logger } from '@core/logger/logger';
import { mailService } from '@core/mail/mail.service';
import { renderAccountSetupEmail } from '@core/mail/templates';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { passwordSetupService, buildSetPasswordUrl } from '@features/iam';

const log = logger.child({ feature: 'employee', module: 'account-email' });

async function fullNameOfEmployee(employeeId: string): Promise<string | undefined> {
  if (!Types.ObjectId.isValid(employeeId)) return undefined;
  const profile = await EmployeeProfile.findOne({ employeeId })
    .select('firstName middleName lastName')
    .lean();
  if (!profile) return undefined;
  return (
    [profile.lastName, profile.middleName, profile.firstName].filter(Boolean).join(' ').trim() ||
    undefined
  );
}

interface AccountEvent {
  userId: string;
  employeeId: string;
  username: string;
  sendTo?: string;
}

/**
 * Issue a single-use password token and email the employee a link to set their
 * own password. No password is ever placed in the email.
 */
async function sendSetupLink(evt: AccountEvent, isReset: boolean) {
  if (!evt.sendTo) return; // HR opted out of emailing
  try {
    const rawToken = await passwordSetupService.issue(evt.userId, isReset ? 'reset' : 'setup');
    const actionUrl = buildSetPasswordUrl(rawToken);
    const fullName = await fullNameOfEmployee(evt.employeeId);

    const { subject, html, text } = renderAccountSetupEmail({
      fullName,
      username: evt.username,
      actionUrl,
      isReset,
      expiresInLabel: isReset ? '2 giờ' : '7 ngày',
    });

    await mailService.send({ to: evt.sendTo, subject, html, text });
    log.info({ to: evt.sendTo, employeeId: evt.employeeId, isReset }, 'set-password email dispatched');
  } catch (err) {
    log.error({ err, employeeId: evt.employeeId }, 'failed to dispatch set-password email');
  }
}

/** Register account-related email listeners. Call once at bootstrap. */
export function registerAccountEmailListeners(): void {
  eventBus.on('employee.granted-login', (e) => void sendSetupLink(e, false));
  eventBus.on('employee.account.invite-resent', (e) => void sendSetupLink(e, false));
  eventBus.on('employee.account.password-reset', (e) => void sendSetupLink(e, true));
  log.info('account email listeners registered');
}
