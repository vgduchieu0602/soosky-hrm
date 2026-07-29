import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

export default class ListPayrollPeriodsUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
    ) {}

    public async execute(): Promise<PayrollPeriod[]> {
        return this._periods.listAll();
    }
}
