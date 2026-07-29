import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";

export default class ListSalaryPoliciesUseCase {
    public constructor(
        private readonly _policies: SalaryPolicyRepo,
    ) {}

    public async execute(): Promise<SalaryPolicy[]> {
        return this._policies.listAll();
    }
}
