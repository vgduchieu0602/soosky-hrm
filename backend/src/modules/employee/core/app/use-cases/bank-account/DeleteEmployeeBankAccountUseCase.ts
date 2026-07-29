import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "employee:manage";

export interface DeleteEmployeeBankAccountInput {
    bankAccountId: string;
    actorUserId:   string;
}

/**
 * Xoá một tài khoản ngân hàng. Idempotent — xoá id không tồn tại không lỗi.
 *
 * @throws {AccessDeniedError} Actor không có quyền `employee:manage`.
 */
export default class DeleteEmployeeBankAccountUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _bankAccountRepo: EmployeeBankAccountRepo,
    ) {}

    public async execute(input: DeleteEmployeeBankAccountInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._bankAccountRepo.deleteById(input.bankAccountId);
    }
}
