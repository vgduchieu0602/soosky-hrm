import LeaveQuotaExceededError from "@modules/attendance/core/app/errors/LeaveQuotaExceededError";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import { carryoverWindow, poolAnnualRemaining } from "@modules/attendance/core/domain/services/leave-calc";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";

/**
 * Kiểm tra hạn mức phép năm (bể cộng dồn 3 năm) và hạn mức phép có cấu hình
 * khác trước khi cho phép nộp/duyệt đơn xin nghỉ. Port từ
 * `leave-entitlement.service.ts` bản cũ.
 */
export default class LeaveEntitlementService {
    public constructor(
        private readonly _leaveBalanceRepo: LeaveBalanceRepo,
    ) {}

    /** Số phép năm còn lại dạng bể, cộng dồn trong khoảng năm cho phép. */
    public async remainingAnnual(employeeId: string, year: number): Promise<number> {
        const { from, to } = carryoverWindow(year);
        const rows = await this._leaveBalanceRepo.listInYearWindow(employeeId, LeaveType.ANNUAL.value, from, to);
        return poolAnnualRemaining(rows.map(row => ({ entitled: row.entitled, used: row.used })));
    }

    /**
     * @throws {LeaveQuotaExceededError} Vượt quá hạn mức khả dụng (không áp
     *         dụng với `unpaid` — nghỉ không lương không giới hạn).
     */
    public async assertAvailable(employeeId: string, leaveType: LeaveType, startYear: number, days: number): Promise<void> {
        if (leaveType.isUnpaid) return;

        if (leaveType.isAnnual) {
            const remaining = await this.remainingAnnual(employeeId, startYear);
            if (remaining <= 0) {
                throw new LeaveQuotaExceededError("No annual leave available");
            }
            if (days > remaining) {
                throw new LeaveQuotaExceededError(`Exceeds remaining annual leave (${remaining} days)`);
            }
            return;
        }

        const balance = await this._leaveBalanceRepo.getOne(employeeId, leaveType.value, startYear);
        if (balance == undefined || balance.entitled <= 0) {
            throw new LeaveQuotaExceededError(`No quota configured for leave type "${leaveType.value}" in year ${startYear}`);
        }
        if (balance.used + days > balance.entitled) {
            throw new LeaveQuotaExceededError(`Exceeds remaining leave quota (${balance.remaining} days)`);
        }
    }
}
