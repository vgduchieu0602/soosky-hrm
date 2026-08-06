import EvaluationIncompleteError from "@modules/payroll/core/app/errors/EvaluationIncompleteError";
import PayrollPeriodLockedError from "@modules/payroll/core/app/errors/PayrollPeriodLockedError";
import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import EvaluationDirectory from "@modules/payroll/core/app/ports/EvaluationDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollRunPort from "@modules/payroll/core/app/ports/PayrollRunPort";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

const PERMISSION_KEY = "payroll:prepare";

export interface LockEvaluationsOutput {
    period:      PayrollPeriod;
    autoRunning: boolean;
}

/**
 * Chốt đánh giá của kỳ — điểm hiệu suất/mục tiêu đông cứng cho payroll. Nếu
 * chấm công cũng đã chốt thì tự động chạy lương cả kỳ ngay (mirror
 * `LockAttendanceUseCase`).
 *
 * Chặn chốt khi chu kỳ đánh giá gắn với kỳ này còn nhân viên chưa KHOÁ điểm:
 * chốt lúc đó nghĩa là một số người ăn điểm thật, một số ăn điểm mặc định —
 * chênh lệch giữa những người trong cùng một kỳ lương mà không ai thấy.
 *
 * Kỳ KHÔNG gắn chu kỳ đánh giá nào thì chốt tự do: công ty được quyền không
 * dùng module Đánh giá, chặn ở đây sẽ khoá cứng cả luồng lương.
 *
 * @throws {AccessDeniedError}          Actor không có quyền `payroll:prepare`.
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 * @throws {PayrollPeriodLockedError}   Kỳ đã thanh toán.
 * @throws {EvaluationIncompleteError}  Chu kỳ đánh giá còn nhân viên chưa khoá điểm.
 */
export default class LockEvaluationsUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _periods: PayrollPeriodRepo,
        private readonly _runner: PayrollRunPort,
        private readonly _evaluations: EvaluationDirectory,
    ) {}

    public async execute(input: { periodId: string; actorUserId: string }): Promise<LockEvaluationsOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        if (period.status === "paid") throw new PayrollPeriodLockedError(`Period ${period.name.value} is already paid`);

        const progress = await this._evaluations.progressForPayrollPeriod(input.periodId);
        if (progress != undefined && progress.pendingEmployeeIds.length > 0) {
            throw new EvaluationIncompleteError(
                `${progress.pendingEmployeeIds.length} employee(s) have no locked score in cycle ${progress.cycleId}`,
            );
        }

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
