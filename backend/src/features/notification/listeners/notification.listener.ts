import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { Employee } from '@shared/models/employee.model';
import { Payroll } from '@shared/models/payroll.model';
import { notificationService } from '@features/notification/services/notification.service';

const log = logger.child({ feature: 'notification', module: 'listener' });

async function userIdOfEmployee(employeeId: string): Promise<string | null> {
  const e = await Employee.findById(employeeId).select('userId').lean();
  return e?.userId ? String(e.userId) : null;
}

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
  eventBus.on('payroll.paid', (e) => void notifyPayslipReady(e.periodId));

  // ---- Leave ----
  eventBus.on('leave.submitted', (e) => void notifyLeaveSubmitted(e.employeeId));
  eventBus.on('leave.decided', (e) => void notifyLeaveDecided(e));

  log.info('notification listeners registered');
}

async function notifyPayslipReady(periodId: string) {
  try {
    const payrolls = await Payroll.find({ payrollPeriodId: periodId }).select('employeeId').lean();
    if (payrolls.length === 0) return;
    const employees = await Employee.find({ _id: { $in: payrolls.map((p) => p.employeeId) } })
      .select('userId')
      .lean();
    const userIds = employees.map((e) => e.userId).filter(Boolean).map((u) => String(u));
    await notificationService.notifyMany(userIds, {
      type: 'payroll',
      severity: 'success',
      title: 'Phiếu lương đã sẵn sàng',
      message: 'Kỳ lương đã được chi trả. Xem chi tiết phiếu lương của bạn.',
      link: '/me/payslips',
    });
  } catch (err) {
    log.error({ err, periodId }, 'failed to notify payslip ready');
  }
}

async function notifyLeaveSubmitted(employeeId: string) {
  try {
    const approvers = await notificationService.userIdsByRoles(['admin', 'hr_manager']);
    await notificationService.notifyMany(approvers, {
      type: 'leave',
      title: 'Đơn nghỉ phép mới',
      message: 'Có một đơn nghỉ phép đang chờ duyệt.',
      link: '/leave/approval',
    });
  } catch (err) {
    log.error({ err, employeeId }, 'failed to notify leave submitted');
  }
}

async function notifyLeaveDecided(e: { employeeId: string; approved: boolean; reason?: string }) {
  try {
    const userId = await userIdOfEmployee(e.employeeId);
    if (!userId) return;
    await notificationService.notify({
      userId,
      type: 'leave',
      severity: e.approved ? 'success' : 'warning',
      title: e.approved ? 'Đơn nghỉ phép được duyệt' : 'Đơn nghỉ phép bị từ chối',
      message: e.approved
        ? 'Đơn nghỉ phép của bạn đã được duyệt.'
        : `Đơn nghỉ phép của bạn bị từ chối.${e.reason ? ` Lý do: ${e.reason}` : ''}`,
      link: '/me/leave',
    });
  } catch (err) {
    log.error({ err, employeeId: e.employeeId }, 'failed to notify leave decided');
  }
}
