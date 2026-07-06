import type {
  EmployeeGateway,
  EvaluationGateway,
  LoggerPort,
  PayrollGateway,
} from '@features/notification/domain/ports';
import type { NotificationUseCases } from '@features/notification/application/notification.usecases';

/**
 * Reactions to domain events, mapped to in-app notifications. Each handler is
 * fire-and-forget — failures are logged, never propagated to the emitter.
 */
export class NotificationEventUseCases {
  constructor(
    private readonly notifications: NotificationUseCases,
    private readonly employees: EmployeeGateway,
    private readonly payroll: PayrollGateway,
    private readonly evaluations: EvaluationGateway,
    private readonly log: LoggerPort,
  ) {}

  async notifyPayslipReady(periodId: string): Promise<void> {
    try {
      const userIds = await this.payroll.userIdsForPeriod(periodId);
      if (userIds.length === 0) return;
      await this.notifications.notifyMany(userIds, {
        type: 'payroll',
        severity: 'success',
        title: 'Phiếu lương đã sẵn sàng',
        message: 'Kỳ lương đã được chi trả. Xem chi tiết phiếu lương của bạn.',
        link: '/me/payslips',
      });
    } catch (err) {
      this.log.error({ err, periodId }, 'failed to notify payslip ready');
    }
  }

  async notifyEvaluation(employeeId: string, kind: 'finalized' | 'reopened'): Promise<void> {
    try {
      const userId = await this.employees.userIdOfEmployee(employeeId);
      if (!userId) return;
      if (kind === 'finalized') {
        await this.notifications.notify({
          userId,
          type: 'performance',
          title: 'Kết quả đánh giá đã có',
          message: 'Kết quả đánh giá hiệu suất của bạn đã được duyệt — vui lòng xem và xác nhận.',
          link: '/me/evaluations',
        });
      } else {
        await this.notifications.notify({
          userId,
          type: 'performance',
          severity: 'warning',
          title: 'Đánh giá được mở lại',
          message: 'Bản đánh giá của bạn đã được mở lại để cập nhật. Kết quả có thể thay đổi.',
          link: '/me/evaluations',
        });
      }
    } catch (err) {
      this.log.error({ err, employeeId }, 'failed to notify evaluation');
    }
  }

  async notifyEvaluationDisputed(employeeId: string): Promise<void> {
    try {
      const hr = await this.notifications.userIdsByRoles(['admin', 'hr_manager']);
      const code = await this.employees.employeeCode(employeeId);
      await this.notifications.notifyMany(hr, {
        type: 'performance',
        severity: 'warning',
        title: 'Khiếu nại kết quả đánh giá',
        message: `Nhân viên ${code ?? ''} đã gửi khiếu nại về kết quả đánh giá.`.trim(),
        link: '/performance',
      });
    } catch (err) {
      this.log.error({ err, employeeId }, 'failed to notify evaluation dispute');
    }
  }

  async notifyEvaluationsPending(periodId: string, periodName: string): Promise<void> {
    try {
      const [activeCount, doneCount] = await Promise.all([
        this.employees.countActive(),
        this.evaluations.countApprovedForPeriod(periodId),
      ]);
      const pending = activeCount - doneCount;
      if (pending <= 0) return;
      const hr = await this.notifications.userIdsByRoles(['admin', 'hr_manager']);
      await this.notifications.notifyMany(hr, {
        type: 'performance',
        severity: 'warning',
        title: 'Còn nhân viên chưa được đánh giá',
        message: `Kỳ ${periodName}: còn ${pending} nhân viên chưa có đánh giá được duyệt trước khi tính lương.`,
        link: '/performance',
      });
    } catch (err) {
      this.log.error({ err, periodId }, 'failed to notify pending evaluations');
    }
  }

  async notifyLeaveSubmitted(employeeId: string): Promise<void> {
    try {
      const approvers = await this.notifications.userIdsByRoles(['admin', 'hr_manager']);
      await this.notifications.notifyMany(approvers, {
        type: 'leave',
        title: 'Đơn nghỉ phép mới',
        message: 'Có một đơn nghỉ phép đang chờ duyệt.',
        link: '/leave/approval',
      });
    } catch (err) {
      this.log.error({ err, employeeId }, 'failed to notify leave submitted');
    }
  }

  async notifyLeaveDecided(e: { employeeId: string; approved: boolean; reason?: string }): Promise<void> {
    try {
      const userId = await this.employees.userIdOfEmployee(e.employeeId);
      if (!userId) return;
      await this.notifications.notify({
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
      this.log.error({ err, employeeId: e.employeeId }, 'failed to notify leave decided');
    }
  }
}
