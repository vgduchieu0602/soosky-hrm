import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import { CredentialsInvalidError } from "@modules/auth/core/app/errors/CredentialsInvalidError";
import PasswordHasher from "@modules/auth/core/app/ports/PasswordHasher";
import UnitOfWork from "@modules/auth/core/app/ports/UnitOfWork";
import PlainPassword from "@modules/auth/core/domain/value-objects/PlainPassword";

export interface ChangePasswordInput {
    accountId:       string;
    currentPassword: string;
    newPassword:     string;
}

/**
 * Đổi mật khẩu của chính chủ tài khoản, yêu cầu xác nhận lại mật khẩu hiện tại.
 *
 * Lưu mật khẩu mới và thu hồi toàn bộ refresh token của account nằm trong một
 * UnitOfWork — không có trạng thái nửa vời "mật khẩu đã đổi nhưng phiên cũ còn
 * sống", vì thu hồi phiên chính là mục đích khi đổi mật khẩu do nghi ngờ lộ.
 */
export default class ChangePasswordUseCase {
    public constructor(
        private readonly _uow: UnitOfWork,
        private readonly _passwordHasher: PasswordHasher,
    ) {}

    /**
     * @param input.accountId       Id account cần đổi mật khẩu (chính là actor).
     * @param input.currentPassword Mật khẩu hiện tại, để xác nhận chính chủ.
     * @param input.newPassword     Mật khẩu mới, sẽ được băm trước khi lưu.
     *
     * @throws {PasswordInvalidError}    Mật khẩu mới quá ngắn hoặc quá dài.
     * @throws {AccountNotFoundError}    Account không tồn tại.
     * @throws {CredentialsInvalidError} Mật khẩu hiện tại không đúng.
     * @throws {AccountDeactivatedError} Account đã bị vô hiệu hoá.
     */
    public async execute(input: ChangePasswordInput): Promise<void> {
        // Mật khẩu hiện tại không cần đúng quy tắc mới — chỉ mật khẩu mới phải đạt.
        const newPassword = PlainPassword.create(input.newPassword);

        // Băm trước khi vào transaction — scrypt chậm có chủ đích, giữ transaction ngắn.
        const newHash = await this._passwordHasher.hash(newPassword.value);

        await this._uow.run(async ctx => {
            const account = await ctx.accountRepo.getById(input.accountId);
            if (account == undefined) {
                throw new AccountNotFoundError();
            }

            const currentPasswordMatches = await this._passwordHasher.verify(input.currentPassword, account.passwordHash);
            if (!currentPasswordMatches) {
                throw new CredentialsInvalidError();
            }

            account.changePassword(newHash);
            await ctx.accountRepo.save(account);

            await ctx.refreshTokenStore.revokeAllForAccount(account.id);
        });
    }
}
