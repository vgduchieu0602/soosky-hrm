import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "employee:manage";

export interface CreateEmployeeBankAccountInput {
    employeeId:    string;
    bankName:      string;
    branch?: string | undefined;
    accountNumber: string;
    accountHolder: string;
    isPrimary?: boolean | undefined;
    actorUserId:   string;
}

export interface CreateEmployeeBankAccountOutput {
    bankAccountId: string;
}

/**
 * Thêm tài khoản ngân hàng nhận lương cho nhân viên.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class CreateEmployeeBankAccountUseCase {
    public constructor(
        private readonly _permissions:   PermissionChecker,
        private readonly _employeeRepo:  EmployeeRepo,
        private readonly _bankAccountRepo: EmployeeBankAccountRepo,
    ) {}

    public async execute(input: CreateEmployeeBankAccountInput): Promise<CreateEmployeeBankAccountOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const account = EmployeeBankAccount.create({
            id:            UUIDv7(),
            employeeId:    input.employeeId,
            bankName:      input.bankName,
            branch:        input.branch ?? null,
            accountNumber: input.accountNumber,
            accountHolder: input.accountHolder,
            isPrimary:     input.isPrimary ?? false,
        });

        await this._bankAccountRepo.save(account);

        return { bankAccountId: account.id };
    }
}
