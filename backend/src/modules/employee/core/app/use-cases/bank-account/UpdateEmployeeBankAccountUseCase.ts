import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "employee:manage";

export interface UpdateEmployeeBankAccountInput {
    bankAccountId: string;
    bankName?: string | undefined;
    branch?: string | null | undefined;
    accountNumber?: string | undefined;
    accountHolder?: string | undefined;
    isPrimary?: boolean | undefined;
    actorUserId:   string;
}

/**
 * Cập nhật một tài khoản ngân hàng.
 *
 * @throws {AccessDeniedError}               Actor không có quyền `employee:manage`.
 * @throws {EmployeeSubResourceNotFoundError} Tài khoản không tồn tại.
 */
export default class UpdateEmployeeBankAccountUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _bankAccountRepo: EmployeeBankAccountRepo,
    ) {}

    public async execute(input: UpdateEmployeeBankAccountInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const account = await this._bankAccountRepo.getById(input.bankAccountId);
        if (account == undefined) throw new EmployeeSubResourceNotFoundError();

        account.update({
            bankName:      input.bankName,
            branch:        input.branch,
            accountNumber: input.accountNumber,
            accountHolder: input.accountHolder,
            isPrimary:     input.isPrimary,
        });

        await this._bankAccountRepo.save(account);
    }
}
