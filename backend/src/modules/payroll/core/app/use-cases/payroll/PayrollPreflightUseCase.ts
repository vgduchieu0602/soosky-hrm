import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
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
 * Kiểm tra trước khi chạy lương: nhân viên active nào sẽ bị CHẶN (không có
 * hợp đồng active) và chính sách lương có hiệu lực hay chưa. Giản lược so
 * với bản cũ: không kiểm tra thiếu đánh giá tháng (chưa có module Đánh giá,
 * xem payroll-report.md) hay thiếu hồ sơ thuế (không chặn tính lương).
 */
export default class PayrollPreflightUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _policies: SalaryPolicyRepo,
    ) {}

    public async execute(input: { periodId: string }): Promise<PayrollPreflightOutput> {
        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const policy = await this._policies.findEffectiveAt(period.payDate);
        const employeeIds = await this._employees.listActiveEmployeeIds();

        const items: PreflightItem[] = [];
        for (const employeeId of employeeIds) {
            const contract = await this._employees.contractBasis(employeeId, period.payDate);
            const blockers: string[] = [];
            if (contract == undefined) blockers.push("No active contract");
            if (blockers.length > 0) items.push({ employeeId, blockers });
        }

        const policyWarnings: string[] = [];
        if (policy == undefined) policyWarnings.push("No salary policy in effect — payroll cannot be computed");

        return {
            total: employeeIds.length,
            ready: employeeIds.length - items.length,
            blockedCount: items.length,
            policyWarnings,
            items,
        };
    }
}
