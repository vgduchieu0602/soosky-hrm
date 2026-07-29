import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import Deduction from "@modules/payroll/core/domain/entities/Deduction";

export default class ListDeductionsByEmployeeUseCase {
    public constructor(
        private readonly _deductions: DeductionRepo,
    ) {}

    public async execute(input: { employeeId: string }): Promise<Deduction[]> {
        return this._deductions.listByEmployeeId(input.employeeId);
    }
}
