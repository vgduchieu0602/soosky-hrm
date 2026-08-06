import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
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
        private readonly _auditTrail:      AuditTrail,
    ) {}

    public async execute(input: DeleteEmployeeBankAccountInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        // Doc truoc khi xoa de nhat ky giu duoc so tai khoan da bi go.
        const account = await this._bankAccountRepo.getById(input.bankAccountId);

        await this._bankAccountRepo.deleteById(input.bankAccountId);

        if (account == undefined) return;

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_bank_account",
            action:      "delete",
            resourceId:  account.id,
            changes:     {
                employeeId:    account.employeeId,
                bankName:      account.bankName,
                accountNumber: account.accountNumber,
                accountHolder: account.accountHolder,
                isPrimary:     account.isPrimary,
            },
        });
    }
}
