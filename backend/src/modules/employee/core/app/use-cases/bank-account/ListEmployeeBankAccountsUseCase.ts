import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";

export interface ListEmployeeBankAccountsInput {
    employeeId: string;
}

/** Liệt kê tài khoản ngân hàng của một nhân viên. */
export default class ListEmployeeBankAccountsUseCase {
    public constructor(
        private readonly _bankAccountRepo: EmployeeBankAccountRepo,
    ) {}

    public async execute(input: ListEmployeeBankAccountsInput): Promise<EmployeeBankAccount[]> {
        return this._bankAccountRepo.listByEmployeeId(input.employeeId);
    }
}
