import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import EvaluationDirectory from "@modules/payroll/core/app/ports/EvaluationDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";

export interface PreflightItem {
    employeeId: string;
    blockers:   string[];
}

export interface PayrollPreflightOutput {
    total:          number;
    ready:          number;
    blockedCount:   number;
    policyWarnings: string[];
    items:          PreflightItem[];
}

/**
 * Kiểm tra trước khi chạy lương — liệt kê MỌI thứ sẽ làm số lương sai hoặc
 * thiếu, để HR sửa TRƯỚC khi tính chứ không phát hiện sau khi đã duyệt.
 *
 * Các nhóm chặn:
 *  - nhân viên không có hợp đồng active tại ngày trả lương;
 *  - nhân viên chưa có điểm đánh giá ĐÃ KHOÁ, khi kỳ này gắn một chu kỳ đánh giá
 *    (kỳ không gắn chu kỳ nào thì chạy với điểm mặc định — cảnh báo, không chặn).
 *
 * Cảnh báo cấp kỳ: chưa có chính sách lương hiệu lực.
 *
 * Dùng CÙNG nguồn số liệu với `EvaluationReadinessUseCase` và
 * `LockEvaluationsUseCase` (`EvaluationDirectory`) — nên "preflight nói thiếu" và
 * "chốt đánh giá bị chặn" không bao giờ lệch nhau.
 *
 * @throws {PayrollPeriodNotFoundError} Không tìm thấy kỳ lương.
 */
export default class PayrollPreflightUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _policies: SalaryPolicyRepo,
        private readonly _evaluations: EvaluationDirectory,
    ) {}

    public async execute(input: { periodId: string }): Promise<PayrollPreflightOutput> {
        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const policy      = await this._policies.findEffectiveAt(period.payDate);
        const employeeIds = await this._employees.listActiveEmployeeIds();
        const progress    = await this._evaluations.progressForPayrollPeriod(input.periodId);

        const pendingEvaluation = new Set(progress?.pendingEmployeeIds ?? []);

        const items: PreflightItem[] = [];
        for (const employeeId of employeeIds) {
            const blockers: string[] = [];

            const contract = await this._employees.contractBasis(employeeId, period.payDate);
            if (contract == undefined) blockers.push("No active contract");

            if (pendingEvaluation.has(employeeId)) blockers.push("No locked appraisal score");

            if (blockers.length > 0) items.push({ employeeId, blockers });
        }

        const policyWarnings: string[] = [];
        if (policy == undefined) policyWarnings.push("No salary policy in effect — payroll cannot be computed");
        if (progress == undefined) {
            policyWarnings.push("No appraisal cycle linked to this period — payroll will use default scores (100/100)");
        }

        return {
            total: employeeIds.length,
            ready: employeeIds.length - items.length,
            blockedCount: items.length,
            policyWarnings,
            items,
        };
    }
}
