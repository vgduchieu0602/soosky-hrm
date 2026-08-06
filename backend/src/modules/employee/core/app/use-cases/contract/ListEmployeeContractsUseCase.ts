import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeContract from "@modules/employee/core/domain/entities/EmployeeContract";

export interface ListEmployeeContractsInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Liệt kê hợp đồng lao động của một nhân viên, trong phạm vi actor được đọc.
 * Hợp đồng chứa lương nên đây là dữ liệu nhạy cảm nhất của hồ sơ.
 *
 * @throws {AccessDeniedError} Actor không được đọc hồ sơ của nhân viên này.
 */
export default class ListEmployeeContractsUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _contractRepo: EmployeeContractRepo,
    ) {}

    public async execute(input: ListEmployeeContractsInput): Promise<EmployeeContract[]> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
        return this._contractRepo.listByEmployeeId(input.employeeId);
    }
}
