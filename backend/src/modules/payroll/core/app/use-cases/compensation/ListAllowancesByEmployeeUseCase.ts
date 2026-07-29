import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";

export default class ListAllowancesByEmployeeUseCase {
    public constructor(
        private readonly _allowances: AllowanceRepo,
    ) {}

    public async execute(input: { employeeId: string }): Promise<Allowance[]> {
        return this._allowances.listByEmployeeId(input.employeeId);
    }
}
