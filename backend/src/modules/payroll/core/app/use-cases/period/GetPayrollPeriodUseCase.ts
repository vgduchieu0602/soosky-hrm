import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

export default class GetPayrollPeriodUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
    ) {}

    public async execute(input: { periodId: string }): Promise<PayrollPeriod> {
        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();
        return period;
    }
}
