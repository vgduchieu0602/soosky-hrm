import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";
import createUuidV7 from "@shared/core/domain/UuidV7";

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
        private readonly _auditTrail:      AuditTrail,
    ) {}

    public async execute(input: CreateEmployeeBankAccountInput): Promise<CreateEmployeeBankAccountOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const account = EmployeeBankAccount.create({
            id:            createUuidV7(),
            employeeId:    input.employeeId,
            bankName:      input.bankName,
            branch:        input.branch ?? null,
            accountNumber: input.accountNumber,
            accountHolder: input.accountHolder,
            isPrimary:     input.isPrimary ?? false,
        });

        await this._bankAccountRepo.save(account);

        // "Tài khoản nhận lương chính" phải là DUY NHẤT: Payroll cần một câu trả
        // lời rõ ràng cho câu hỏi "chuyển tiền vào đâu". Đặt cái mới làm chính thì
        // hạ cờ ở những cái còn lại thay vì báo lỗi — đó là ý định của người dùng.
        if (account.isPrimary) await this._demoteOtherPrimaries(input.employeeId, account.id);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_bank_account",
            action:      "create",
            resourceId:  account.id,
            changes:     {
                employeeId:    account.employeeId,
                bankName:      account.bankName,
                branch:        account.branch,
                accountNumber: account.accountNumber,
                accountHolder: account.accountHolder,
                isPrimary:     account.isPrimary,
            },
        });

        return { bankAccountId: account.id };
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
