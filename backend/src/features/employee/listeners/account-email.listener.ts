import { Types } from 'mongoose';
import { env } from '@config/env';
import { eventBus } from '@core/events/event-bus';
import { logger } from '@core/logger/logger';
import { mailService } from '@core/mail/mail.service';
import { renderAccountCredentialsEmail } from '@core/mail/templates';
import { EmployeeProfile } from '@shared/models/employee-profile.model';

const log = logger.child({ feature: 'employee', module: 'account-email' });

const LOGIN_URL = `${env.APP_WEB_URL.replace(/\/$/, '')}/auth/login`;

async function fullNameOfEmployee(employeeId: string): Promise<string | undefined> {
  if (!Types.ObjectId.isValid(employeeId)) return undefined;
  const profile = await EmployeeProfile.findOne({ employeeId }).select('firstName lastName').lean();
  if (!profile) return undefined;
  return [profile.lastName, profile.firstName].filter(Boolean).join(' ').trim() || undefined;
}

interface CredentialEvent {
  userId: string;
  employeeId: string;
  username: string;
  tempPassword: string;
  sendTo?: string;
}

async function sendCredentials(evt: CredentialEvent, isReset: boolean) {
  if (!evt.sendTo) return; // HR opted out of emailing
  try {
    const fullName = await fullNameOfEmployee(evt.employeeId);
    const { subject, html, text } = renderAccountCredentialsEmail({
      fullName,
      username: evt.username,
      tempPassword: evt.tempPassword,
      loginUrl: LOGIN_URL,
      isReset,
    });
    await mailService.send({ to: evt.sendTo, subject, html, text });
    log.info({ to: evt.sendTo, employeeId: evt.employeeId, isReset }, 'credential email dispatched');
  } catch (err) {
    log.error({ err, employeeId: evt.employeeId }, 'failed to dispatch credential email');
  }
}

/** Register account-related email listeners. Call once at bootstrap. */
export function registerAccountEmailListeners(): void {
  eventBus.on('employee.granted-login', (e) => void sendCredentials(e, false));
  eventBus.on('employee.account.invite-resent', (e) => void sendCredentials(e, false));
  eventBus.on('employee.account.password-reset', (e) => void sendCredentials(e, true));
  log.info('account email listeners registered');
}
