import { HttpError } from '@shared/errors/http-error';
import type { LeaveType } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';
import { vnDateKey } from '@modules/hrm/core/attendance/domain/attendance-calc';
import { carryoverWindow, poolAnnualRemaining } from '@modules/hrm/core/attendance/domain/leave-policy';
import type {
  LeaveBalanceRepository,
  EmployeeGateway,
  PolicyGateway,
  Id,
  Tx,
} from '@modules/hrm/core/attendance/domain/ports';

/**
 * Annual-leave entitlement + quota checks. Shared by the attendance grid
 * (pooled remaining) and leave submit/approve (quota enforcement).
 */
export class LeaveEntitlementService {
  constructor(
    private readonly balances: LeaveBalanceRepository,
    private readonly employees: EmployeeGateway,
    private readonly policy: PolicyGateway,
  ) {}

  /** Lazily grant an official employee this year's annual entitlement. */
  async ensureEntitlement(employeeId: Id, year: number, tx?: Tx): Promise<void> {
    const existing = await this.balances.findOne(employeeId, 'annual', year, tx);
    if (existing) return;
    if (!(await this.employees.isOfficial(employeeId, tx))) return;
    const entitled = await this.policy.annualQuota();
    await this.balances.ensureEntitlement(employeeId, year, entitled, tx);
  }

  /** Pooled remaining annual leave over the carry-over window. */
  async remaining(employeeId: Id, year: number, tx?: Tx): Promise<number> {
    const { from, to } = carryoverWindow(year);
    const rows = await this.balances.findInYearWindow(employeeId, from, to, tx);
    return poolAnnualRemaining(rows);
  }

  /** Throw LV_004/LV_005 if the leave type has a finite quota and would be exceeded. */
  async assertAvailable(employeeId: Id, leaveType: LeaveType, startDate: Date, days: number, tx?: Tx): Promise<void> {
    if (leaveType === 'unpaid') return;
    const year = vnDateKey(startDate).getUTCFullYear();

    if (leaveType === 'annual') {
      await this.ensureEntitlement(employeeId, year, tx);
      const remaining = await this.remaining(employeeId, year, tx);
      if (remaining <= 0) {
        throw new HttpError(
          409,
          `Không còn phép năm khả dụng (nhân viên chưa chính thức hoặc đã dùng hết).`,
          'LV_005',
        );
      }
      if (days > remaining) {
        throw new HttpError(409, `Vượt quỹ phép năm còn lại (${remaining} ngày)`, 'LV_004');
      }
      return;
    }

    const balance = await this.balances.findOne(employeeId, leaveType, year, tx);
    if (!balance || balance.entitled <= 0) {
      throw new HttpError(
        409,
        `Chưa cấu hình hạn mức phép "${leaveType}" cho năm ${year}. Liên hệ HR để thiết lập.`,
        'LV_005',
      );
    }
    if (balance.used + days > balance.entitled) {
      const remaining = balance.entitled - balance.used;
      throw new HttpError(409, `Vượt quỹ phép còn lại (${remaining} ngày)`, 'LV_004');
    }
  }
}
