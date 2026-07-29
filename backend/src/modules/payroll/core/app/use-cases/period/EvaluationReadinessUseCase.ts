import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";

export interface EvaluationReadinessOutput {
    evaluationLocked:      boolean;
    totalActiveEmployees:  number;
    finalizedEvaluations:  number;
    employeesNoEvaluation: number;
}

/**
 * Kiểm tra trước khi chốt đánh giá tháng. Module Đánh giá (Performance) CHƯA
 * tồn tại trong codebase mới — mọi nhân viên coi như đã "sẵn sàng" (điểm mặc
 * định 100/100, xem `RunPayrollForEmployeeUseCase` + payroll-report.md); giữ
 * lại use-case này để khớp bề mặt API cũ và sẵn sàng nối dây thật khi module
 * Đánh giá ra đời.
 */
export default class EvaluationReadinessUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
        private readonly _employees: EmployeeDirectory,
    ) {}

    public async execute(input: { periodId: string }): Promise<EvaluationReadinessOutput> {
        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const employeeIds = await this._employees.listActiveEmployeeIds();

        return {
            evaluationLocked: period.evaluationLockedAt != null,
            totalActiveEmployees: employeeIds.length,
            finalizedEvaluations: employeeIds.length,
            employeesNoEvaluation: 0,
        };
    }
}
