import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";

export interface ListEmployeeBankAccountsInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Liệt kê tài khoản ngân hàng của một nhân viên, trong phạm vi actor được đọc.
 *
 * @throws {AccessDeniedError} Actor không được đọc hồ sơ của nhân viên này.
 */
export default class ListEmployeeBankAccountsUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _bankAccountRepo: EmployeeBankAccountRepo,
    ) {}

    public async execute(input: ListEmployeeBankAccountsInput): Promise<EmployeeBankAccount[]> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
        return this._bankAccountRepo.listByEmployeeId(input.employeeId);
    }
}
