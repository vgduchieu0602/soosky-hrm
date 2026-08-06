import { EmailAlreadyInUseError } from "@modules/auth/core/app/errors/EmailAlreadyInUseError";
import { SuperAdminAlreadyExistsError } from "@modules/auth/core/app/errors/SuperAdminAlreadyExistsError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import PasswordHasher from "@modules/auth/core/app/ports/PasswordHasher";
import Account from "@modules/auth/core/domain/entities/Account";
import { AccountVerifiedEvent } from "@modules/auth/core/domain/events/AccountVerifiedEvent";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import FullName from "@modules/auth/core/domain/value-objects/FullName";
import PlainPassword from "@modules/auth/core/domain/value-objects/PlainPassword";
import EventBus from "@shared/core/domain/EventBus";
import createUuidV7 from "@shared/core/domain/UuidV7";
import Email from "@shared/core/domain/value-objects/email/Email";

export interface RegisterSuperAdminAccountInput {
    email:    string;
    password: string;
    fullName: string;
}

/**
 * Bootstrap tài khoản SUPER_ADMIN (owner) duy nhất của hệ thống — chỉ gọi
 * được từ driver adapter CLI lúc khởi tạo môi trường, không mở qua HTTP API.
 *
 * Khác với đăng ký member: account được kích hoạt ngay (bootstrap không có
 * bước xác minh email) và phát luôn `auth.account.verified` để các module
 * khác tạo bản chiếu user.
 *
 * Hệ thống chỉ có một SUPER_ADMIN: đã tồn tại thì từ chối. Role owner sau đó
 * không thể trao/gỡ qua ChangeAccountRole (SuperAdminRoleImmutableError), nên
 * bootstrap là con đường duy nhất sinh ra owner.
 *
 * Các bước kiểm tra (owner đã tồn tại, email trùng) không atomic với bước
 * lưu; unique index trên email là chốt chặn cuối, còn hai lần bootstrap chạy
 * đua là rủi ro chấp nhận được với thao tác vận hành chạy một lần.
 */
export default class RegisterSuperAdminAccountUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
        private readonly _passwordHasher: PasswordHasher,
        private readonly _eventBus: EventBus,
    ) {}

    /**
     * @param input.email    Email đăng nhập của owner.
     * @param input.password Mật khẩu thô, sẽ được băm trước khi lưu.
     * @param input.fullName Họ tên của chủ tài khoản.
     *
     * @returns Account owner vừa được tạo, đã ở trạng thái "active".
     *
     * @throws {EmailInvalidError}           Email sai định dạng.
     * @throws {PasswordInvalidError}        Mật khẩu quá ngắn hoặc quá dài.
     * @throws {FullNameInvalidError}        Họ tên rỗng.
     * @throws {SuperAdminAlreadyExistsError} Hệ thống đã có tài khoản owner.
     * @throws {EmailAlreadyInUseError}      Email đã có account khác sử dụng.
     */
    public async execute(input: RegisterSuperAdminAccountInput): Promise<Account> {
        const email    = Email.create(input.email);
        const fullName = FullName.create(input.fullName);
        const password = PlainPassword.create(input.password);

        if (await this._accountRepo.existsByRole(AccountRole.SUPER_ADMIN)) {
            throw new SuperAdminAlreadyExistsError();
        }
        if (await this._accountRepo.existsByEmail(email)) {
            throw new EmailAlreadyInUseError();
        }

        const account = Account.register({
            id:           createUuidV7(),
            email:        email,
            passwordHash: await this._passwordHasher.hash(password.value),
            fullName:     fullName,
            role:         AccountRole.SUPER_ADMIN,
            // Mật khẩu do người vận hành tự nhập ở CLI, không phải mật khẩu tạm.
            mustChangePassword: false,
        });
        account.verify();

        await this._accountRepo.save(account);
        await this._eventBus.publish([new AccountVerifiedEvent(account)]);

        return account;
    }
}
