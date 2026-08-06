import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
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
        private readonly _auditTrail:      AuditTrail,
    ) {}

    public async execute(input: UpdateEmployeeBankAccountInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const account = await this._bankAccountRepo.getById(input.bankAccountId);
        if (account == undefined) throw new EmployeeSubResourceNotFoundError();

        const before = {
            bankName:      account.bankName,
            branch:        account.branch,
            accountNumber: account.accountNumber,
            accountHolder: account.accountHolder,
            isPrimary:     account.isPrimary,
        };

        account.update({
            bankName:      input.bankName,
            branch:        input.branch,
            accountNumber: input.accountNumber,
            accountHolder: input.accountHolder,
            isPrimary:     input.isPrimary,
        });

        await this._bankAccountRepo.save(account);

        // Xem ghi chú ở CreateEmployeeBankAccountUseCase: cờ "chính" là duy nhất.
        if (input.isPrimary === true) await this._demoteOtherPrimaries(account.employeeId, account.id);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_bank_account",
            action:      "update",
            resourceId:  account.id,
            changes:     {
                employeeId: account.employeeId,
                before,
                after: {
                    bankName:      account.bankName,
                    branch:        account.branch,
                    accountNumber: account.accountNumber,
                    accountHolder: account.accountHolder,
                    isPrimary:     account.isPrimary,
                },
            },
        });
    }

    private async _demoteOtherPrimaries(employeeId: string, keepId: string): Promise<void> {
        const siblings = await this._bankAccountRepo.listByEmployeeId(employeeId);
        for (const sibling of siblings) {
            if (sibling.id === keepId || !sibling.isPrimary) continue;
            sibling.update({ isPrimary: false });
            await this._bankAccountRepo.save(sibling);
        }
    }
}
