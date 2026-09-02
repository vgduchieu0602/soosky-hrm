import { eventBus } from '@infra/events/event-bus';
import {
  notificationService,
  notificationEventUseCases,
  notificationLogger,
} from '@modules/hrm/adapters/container/notification';

/**
 * Subscribe in-app notifications to the existing domain events. Each handler is
 * fire-and-forget — failures are logged, never propagated to the emitter.
 */
export function registerNotificationListeners(): void {
  // ---- Account lifecycle ----
  eventBus.on('employee.granted-login', (e) =>
    void notificationService.notify({
      userId: e.userId,
      type: 'account',
      title: 'Tài khoản đã được cấp',
      message: 'Kiểm tra email để đặt mật khẩu và kích hoạt tài khoản.',
      link: '/me/profile',
    }),
  );
  eventBus.on('employee.account.invite-resent', (e) =>
    void notificationService.notify({
      userId: e.userId,
      type: 'account',
      title: 'Lời mời kích hoạt đã được gửi lại',
      message: 'Một liên kết kích hoạt mới đã được gửi tới email của bạn.',
      link: '/me/profile',
    }),
  );
  eventBus.on('employee.account.password-reset', (e) =>
    void notificationService.notify({
      userId: e.userId,
      type: 'security',
      severity: 'warning',
      title: 'Yêu cầu đặt lại mật khẩu',
      message: 'Một liên kết đặt lại mật khẩu đã được gửi tới email của bạn.',
    }),
  );

  // ---- Security ----
  eventBus.on('iam.user.locked', (e) =>
    void notificationService.notify({
      userId: e.userId,
      type: 'security',
      severity: 'critical',
      title: 'Tài khoản đã bị khoá',
      message: 'Tài khoản bị khoá do đăng nhập sai quá nhiều lần. Liên hệ HR để mở khoá.',
    }),
  );
  eventBus.on('iam.user.password-changed', (e) =>
    void notificationService.notify({
      userId: e.userId,
      type: 'security',
      severity: 'success',
      title: 'Mật khẩu đã được thay đổi',
      message: 'Mật khẩu tài khoản của bạn vừa được cập nhật.',
    }),
  );

  // ---- Payroll: payslip ready for each employee in the period ----
  eventBus.on('payroll.paid', (e) => void notificationEventUseCases.notifyPayslipReady(e.periodId));

  // ---- Leave ----
  eventBus.on('leave.submitted', (e) => void notificationEventUseCases.notifyLeaveSubmitted(e.employeeId));
  eventBus.on('leave.decided', (e) => void notificationEventUseCases.notifyLeaveDecided(e));

  // ---- Performance evaluation ----
  eventBus.on('evaluation.finalized', (e) => void notificationEventUseCases.notifyEvaluation(e.employeeId, 'finalized'));
  eventBus.on('evaluation.reopened', (e) => void notificationEventUseCases.notifyEvaluation(e.employeeId, 'reopened'));
  eventBus.on('evaluation.disputed', (e) => void notificationEventUseCases.notifyEvaluationDisputed(e.employeeId));

  // ---- Payroll: HR reminder when attendance is locked but evaluations pending ----
  eventBus.on(
    'payroll.attendance-locked',
    (e) => void notificationEventUseCases.notifyEvaluationsPending(e.periodId, e.periodName),
  );

  notificationLogger.info('notification listeners registered');
}
