import PayslipRepo, { PayslipListFilter } from "@modules/payroll/core/app/ports/PayslipRepo";
import Payslip from "@modules/payroll/core/domain/entities/Payslip";

export default class ListPayrollsUseCase {
    public constructor(
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { filter: PayslipListFilter; page: number; limit: number }): Promise<{ items: Payslip[]; total: number }> {
        return this._payslips.paginate(input.filter, input.page, input.limit);
    }
}
