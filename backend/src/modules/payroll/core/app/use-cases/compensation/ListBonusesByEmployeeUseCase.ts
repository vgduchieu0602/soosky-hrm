import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import Bonus from "@modules/payroll/core/domain/entities/Bonus";

export default class ListBonusesByEmployeeUseCase {
    public constructor(
        private readonly _bonuses: BonusRepo,
    ) {}

    public async execute(input: { employeeId: string }): Promise<Bonus[]> {
        return this._bonuses.listByEmployeeId(input.employeeId);
    }
}
