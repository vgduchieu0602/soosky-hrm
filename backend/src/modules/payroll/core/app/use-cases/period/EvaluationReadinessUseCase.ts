import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import EvaluationDirectory from "@modules/payroll/core/app/ports/EvaluationDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";

export interface EvaluationReadinessOutput {
    evaluationLocked:      boolean;
    totalActiveEmployees:  number;
    finalizedEvaluations:  number;
    employeesNoEvaluation: number;
    /** Nhân viên còn thiếu điểm — để HR biết phải đi đòi ai. */
    pendingEmployeeIds:    string[];
    /**
     * `null` khi kỳ lương này KHÔNG gắn chu kỳ đánh giá nào. Lúc đó công ty
     * không dùng module Đánh giá cho kỳ này, và bảng lương chạy với điểm mặc
     * định (xem `RunPayrollForEmployeeUseCase`).
     */
    appraisalCycleId:      string | null;
}

/**
 * Kiểm tra trước khi chốt đánh giá: mọi nhân viên đang làm việc đã có điểm ĐÃ
 * KHOÁ chưa.
 *
 * Số liệu lấy từ module Performance qua {@link EvaluationDirectory} — nhưng chỉ
 * là TIẾN ĐỘ, không phải điểm. Điểm thật đã nằm trong bản chụp của chính kỳ
 * lương, nên câu trả lời "đủ điểm chưa" và con số dùng để tính lương không thể
 * lệch nhau.
 *
 * Kỳ không gắn chu kỳ đánh giá thì coi như sẵn sàng: công ty được quyền không
 * dùng module Đánh giá, và chặn ở đây sẽ khoá cứng cả luồng lương.
 *
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 */
export default class EvaluationReadinessUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _evaluations: EvaluationDirectory,
    ) {}

    public async execute(input: { periodId: string }): Promise<EvaluationReadinessOutput> {
        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const employeeIds = await this._employees.listActiveEmployeeIds();
        const progress    = await this._evaluations.progressForPayrollPeriod(input.periodId);

        if (progress == undefined) {
            return {
                evaluationLocked:      period.evaluationLockedAt != null,
                totalActiveEmployees:  employeeIds.length,
                finalizedEvaluations:  employeeIds.length,
                employeesNoEvaluation: 0,
                pendingEmployeeIds:    [],
                appraisalCycleId:      null,
            };
        }

        return {
            evaluationLocked:      period.evaluationLockedAt != null,
            totalActiveEmployees:  employeeIds.length,
            finalizedEvaluations:  progress.lockedCount,
            employeesNoEvaluation: progress.pendingEmployeeIds.length,
            pendingEmployeeIds:    progress.pendingEmployeeIds,
            appraisalCycleId:      progress.cycleId,
        };
    }
}
