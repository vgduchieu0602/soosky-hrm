import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import EmployeeContract from "@modules/employee/core/domain/entities/EmployeeContract";

export interface ListEmployeeContractsInput {
    employeeId: string;
}

/** Liệt kê hợp đồng lao động của một nhân viên. */
export default class ListEmployeeContractsUseCase {
    public constructor(
        private readonly _contractRepo: EmployeeContractRepo,
    ) {}

    public async execute(input: ListEmployeeContractsInput): Promise<EmployeeContract[]> {
        return this._contractRepo.listByEmployeeId(input.employeeId);
    }
}
