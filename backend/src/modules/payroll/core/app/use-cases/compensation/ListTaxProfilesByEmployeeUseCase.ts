import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";

export default class ListTaxProfilesByEmployeeUseCase {
    public constructor(
        private readonly _taxProfiles: TaxProfileRepo,
    ) {}

    public async execute(input: { employeeId: string }): Promise<TaxProfile[]> {
        return this._taxProfiles.listByEmployeeId(input.employeeId);
    }
}
