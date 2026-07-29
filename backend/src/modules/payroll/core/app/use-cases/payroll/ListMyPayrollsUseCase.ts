import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";

export interface MyPayslip {
    payslip:    Payslip;
    periodName: string;
}

/** Tự phục vụ: phiếu lương đã duyệt/đã chi (không thấy draft) của chính người gọi. */
export default class ListMyPayrollsUseCase {
    public constructor(
        private readonly _payslips: PayslipRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _periods: PayrollPeriodRepo,
    ) {}

    public async execute(input: { actorUserId: string }): Promise<MyPayslip[]> {
        const employeeId = await this._employees.findEmployeeIdByUserId(input.actorUserId);
        if (employeeId == undefined) return [];

        const payslips = await this._payslips.listFinalizedByEmployee(employeeId);

        const result: MyPayslip[] = [];
        for (const payslip of payslips) {
            const period = await this._periods.getById(payslip.payrollPeriodId);
            result.push({ payslip, periodName: period?.name.value ?? "" });
        }
        return result;
    }
}
