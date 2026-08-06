import EmployeeLoginEmailMissingError from "@modules/employee/core/app/errors/EmployeeLoginEmailMissingError";
import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import AccountProvisioner from "@modules/employee/core/app/ports/AccountProvisioner";
import AuditTrail from "@modules/employee/core/app/ports/AuditTrail";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";
import EmployeeAlreadyHasAccountError from "@modules/employee/core/domain/errors/EmployeeAlreadyHasAccountError";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "employee:provision";

export interface GrantEmployeeLoginInput {
    employeeId: string;
    /**
     * Email nhận thư kích hoạt. Bỏ trống → dùng email trên hồ sơ nhân viên.
     * Cho phép ghi đè vì email công ty thường chỉ có sau khi nhân viên vào làm,
     * còn thư mời phải gửi tới hộp thư cá nhân.
     */
    email?: string | undefined;
    actorUserId: string;
}

export interface GrantEmployeeLoginOutput {
    accountId:         string;
    credentialsSentTo: string;
}

/**
 * HR cấp tài khoản đăng nhập cho một nhân viên đã có hồ sơ — bước nối giữa
 * "có hồ sơ" và "tự đăng nhập được":
 *
 *   HR tạo nhân viên → CẤP ACCOUNT (use-case này) → nhân viên nhận mail kèm
 *   mật khẩu tạm + link kích hoạt → kích hoạt → đăng nhập → BỊ BUỘC đổi mật
 *   khẩu (cờ `mustChangePassword`) → dùng hệ thống.
 *
 * Gửi mail và đánh cờ buộc đổi mật khẩu nằm bên module Auth (qua
 * {@link AccountProvisioner}); ở đây chỉ gắn `accountId` vào hồ sơ và ghi vết.
 *
 * Thứ tự CỐ Ý: tạo account trước, gắn vào hồ sơ sau. Nếu đảo lại, hồ sơ có thể
 * trỏ tới account không tồn tại. Rủi ro còn lại — account đã tạo nhưng gắn
 * thất bại — được phát hiện ngay ở lần cấp lại (báo email đã dùng) thay vì âm
 * thầm cho hai người cùng truy cập một hồ sơ.
 *
 * @throws {AccessDeniedError}              Actor không có quyền `employee:provision`.
 * @throws {EmployeeNotFoundError}          Nhân viên không tồn tại.
 * @throws {EmployeeLoginEmailMissingError} Không có email nào để gửi thư kích hoạt.
 * @throws {EmployeeAlreadyHasAccountError} Nhân viên đã có tài khoản.
 * @throws {EmailAlreadyInUseError}         Email đã thuộc một account khác.
 */
export default class GrantEmployeeLoginUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _historyRepo: EmployeeHistoryRepo,
        private readonly _accountProvisioner: AccountProvisioner,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: GrantEmployeeLoginInput): Promise<GrantEmployeeLoginOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        // Kiểm tra "đã có account" TRƯỚC khi gọi sang Auth để không tạo ra
        // account mồ côi rồi mới phát hiện xung đột.
        if (employee.accountId != null) throw new EmployeeAlreadyHasAccountError();

        const email = (input.email ?? employee.email ?? "").trim();
        if (email === "") throw new EmployeeLoginEmailMissingError();

        const account = await this._accountProvisioner.provisionAccount({
            email,
            fullName:       employee.name.value,
            actorAccountId: input.actorUserId,
        });

        employee.linkAccount(account.accountId);
        await this._employeeRepo.save(employee);

        await this._historyRepo.save(EmployeeHistory.create({
            id:              createUuidV7(),
            employeeId:      employee.id,
            eventType:       "account_granted",
            fromValue:       null,
            toValue:         { accountId: account.accountId, email: account.email },
            effectiveDate:   new Date(),
            note:            null,
            createdByUserId: input.actorUserId,
        }));

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "employee_account",
            action:      "grant_login",
            resourceId:  employee.id,
            changes:     { accountId: account.accountId, email: account.email },
        });

        return { accountId: account.accountId, credentialsSentTo: account.email };
    }
}
