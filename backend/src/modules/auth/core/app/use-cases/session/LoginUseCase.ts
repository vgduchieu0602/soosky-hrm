import { CredentialsInvalidError } from "@modules/auth/core/app/errors/CredentialsInvalidError";
import AccessTokenIssuer from "@modules/auth/core/app/ports/AccessTokenIssuer";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import PasswordHasher from "@modules/auth/core/app/ports/PasswordHasher";
import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";
import { AuthTokens, issueAuthTokens } from "@modules/auth/core/app/services/AuthTokens";
import Email from "@shared/core/domain/value-objects/email/Email";

export interface LoginInput {
    email:    string;
    password: string;
}

/**
 * Đăng nhập bằng email + mật khẩu, mở phiên mới bằng một cặp token.
 *
 * Email không tồn tại và sai mật khẩu trả về cùng một lỗi
 * `InvalidCredentialsError` để không tiết lộ email nào đã đăng ký. Trạng thái
 * account chỉ được kiểm tra sau khi mật khẩu đã khớp — người ngoài không dò
 * được account nào đang pending/deactivated.
 */
export default class LoginUseCase {
    public constructor(
        private readonly _accessTokenIssuer: AccessTokenIssuer,
        private readonly _accountRepo: AccountRepo,
        private readonly _passwordHasher: PasswordHasher,
        private readonly _refreshTokenStore: RefreshTokenStore,
    ) {}

    /**
     * @param input.email    Email đăng nhập.
     * @param input.password Mật khẩu thô.
     *
     * @returns Cặp access/refresh token của phiên vừa mở.
     *
     * @throws {InvalidEmailError}       Email sai định dạng.
     * @throws {CredentialsInvalidError} Email chưa đăng ký hoặc sai mật khẩu.
     * @throws {AccountNotVerifiedError} Account chưa xác minh email.
     * @throws {AccountDeactivatedError} Account đã bị vô hiệu hoá.
     */
    public async execute(input: LoginInput): Promise<AuthTokens> {
        const email   = Email.create(input.email);
        const account = await this._accountRepo.getByEmail(email);
        if (account == undefined) {
            throw new CredentialsInvalidError();
        }

        const passwordMatches = await this._passwordHasher.verify(input.password, account.passwordHash);
        if (!passwordMatches) {
            throw new CredentialsInvalidError();
        }

        account.ensureCanLogin();

        return issueAuthTokens(account.id, this._accessTokenIssuer, this._refreshTokenStore);
    }
}
