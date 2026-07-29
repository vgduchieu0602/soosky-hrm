import PayslipRepo, { PayslipTotalsRow } from "@modules/payroll/core/app/ports/PayslipRepo";

/** Tổng gross/net theo từng trạng thái phiếu lương của một kỳ — phục vụ đối chiếu quỹ lương. */
export default class PayrollTotalsUseCase {
    public constructor(
        private readonly _payslips: PayslipRepo,
    ) {}

    public async execute(input: { periodId: string }): Promise<PayslipTotalsRow[]> {
        return this._payslips.totalsForPeriod(input.periodId);
    }
}
