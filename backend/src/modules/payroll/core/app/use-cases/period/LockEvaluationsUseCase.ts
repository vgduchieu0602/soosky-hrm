import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollRunPort from "@modules/payroll/core/app/ports/PayrollRunPort";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:manage";

export interface LockEvaluationsOutput {
    period:      PayrollPeriod;
    autoRunning: boolean;
}

/**
 * Chốt đánh giá tháng của kỳ — điểm hiệu suất/mục tiêu coi như đông cứng cho
 * payroll (module Đánh giá chưa tồn tại nên chốt này chỉ là cờ vòng đời cấp
 * kỳ; xem payroll-report.md). Nếu chấm công cũng đã chốt, tự động chạy lương
 * cả kỳ ngay — mirror `LockAttendanceUseCase`.
 */
export default class LockEvaluationsUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _runner: PayrollRunPort,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<LockEvaluationsOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);

        period.lockEvaluations(input.actorUserId);
        await this._periods.save(period);

        let autoRunning = false;
        if (period.isFullyLocked) {
            await this._runner.forPeriod(period.id, input.actorUserId);
            autoRunning = true;
        }

        return { period, autoRunning };
    }
}
