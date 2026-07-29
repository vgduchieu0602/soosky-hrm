import { EmailAlreadyInUseError } from "@modules/auth/core/app/errors/EmailAlreadyInUseError";
import PasswordHasher from "@modules/auth/core/app/ports/PasswordHasher";
import UnitOfWork from "@modules/auth/core/app/ports/UnitOfWork";
import VerificationMailer from "@modules/auth/core/app/ports/VerificationMailer";
import Account from "@modules/auth/core/domain/entities/Account";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import FullName from "@modules/auth/core/domain/value-objects/FullName";
import PlainPassword from "@modules/auth/core/domain/value-objects/PlainPassword";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import Email from "@shared/core/domain/value-objects/email/Email";
import { randomBytes } from "node:crypto";
import { v7 as UUIDv7 } from "uuid";

export interface RegisterAccountInput {
    email:          string;
    fullName:       string;
    actorAccountId: string;
}

/**
 * Đăng ký account member mới ở trạng thái "pending", phát hành token xác minh
 * và gửi mail xác minh cho chủ tài khoản.
 *
 * Chỉ actor có role ADMIN trở lên được tạo account — hệ thống không mở đăng
 * ký tự do cho người ngoài. Account sinh ra với mật khẩu tạm ngẫu nhiên, gửi
 * cho chủ tài khoản trong mail xác minh; đăng nhập xong tự đổi qua
 * ChangePassword.
 *
 * Chưa phát sự kiện tích hợp nào ở bước này: bản chiếu user ở các module khác
 * chỉ được tạo khi account được xác minh (`auth.account.verified`).
 *
 * Lưu account và phát hành token nằm trong một UnitOfWork — không có account
 * "pending" mồ côi không token, không mail, giữ chặt email của người đăng ký.
 * Bước kiểm tra email trùng vẫn cần unique index làm chốt chặn cuối cho
 * trường hợp hai đăng ký chạy đua trên hai transaction.
 *
 * Gửi mail nằm trong transaction: mail lỗi thì rollback toàn bộ — không có
 * account nào được tạo mà không có mail, người đăng ký thử lại được ngay.
 * Đổi lại transaction giữ mở trong lúc chờ SMTP, và trường hợp hiếm mail đã
 * đi nhưng commit ngay sau đó lỗi thì người nhận cầm token không tồn tại.
 */
export default class RegisterMemberAccountUseCase {
    public constructor(
        private readonly _uow: UnitOfWork,
        private readonly _passwordHasher: PasswordHasher,
        private readonly _verificationMailer: VerificationMailer,
    ) {}

    /**
     * @param input.email          Email đăng ký, dùng làm định danh đăng nhập.
     * @param input.fullName       Họ tên của chủ tài khoản.
     * @param input.actorAccountId Id account của actor — phải có role ADMIN trở lên.
     *
     * @returns Account vừa được đăng ký.
     *
     * @throws {EmailInvalidError}      Email sai định dạng.
     * @throws {FullNameInvalidError}   Họ tên rỗng.
     * @throws {AccessDeniedError}      Actor không tồn tại hoặc dưới role ADMIN.
     * @throws {EmailAlreadyInUseError} Email đã có account khác sử dụng.
     */
    public async execute(input: RegisterAccountInput): Promise<Account> {
        const email    = Email.create(input.email);
        const fullName = FullName.create(input.fullName);
        const password = PlainPassword.create(this._generateRandomPassword());

        // Băm trước khi vào transaction — scrypt chậm có chủ đích, giữ transaction ngắn.
        const passwordHash = await this._passwordHasher.hash(password.value);

        const account = await this._uow.run(async ctx => {
            const actor = await ctx.accountRepo.getById(input.actorAccountId);
            if (actor == undefined || actor.role.isLowerThan(AccountRole.ADMIN)) {
                throw new AccessDeniedError();
            }

            if (await ctx.accountRepo.existsByEmail(email)) {
                throw new EmailAlreadyInUseError();
            }

            const account = Account.register({
                id:           UUIDv7(),
                email:        email,
                passwordHash: passwordHash,
                fullName:     fullName,
                role:         AccountRole.MEMBER, // account mới luôn là member; nâng quyền qua ChangeAccountRole
            });
            await ctx.accountRepo.save(account);

            const verification = await ctx.verificationTokenStore.issue(account.id);
            await this._verificationMailer.sendVerificationMail(account.email, password.value, verification);

            return account;
        });


        return account;
    }

    private _generateRandomPassword(): string {
        return randomBytes(32).toString("base64url");
    }
}
