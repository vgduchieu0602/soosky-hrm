import { RefreshTokenInvalidError } from "@modules/auth/core/app/errors/RefreshTokenInvalidError";
import AccessTokenIssuer from "@modules/auth/core/app/ports/AccessTokenIssuer";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";
import { AuthTokens, issueAuthTokens } from "@modules/auth/core/app/services/AuthTokens";

export interface RefreshSessionInput {
    refreshToken: string;
}

/**
 * Gia hạn phiên bằng refresh token: đổi token cũ lấy một cặp token hoàn toàn
 * mới (rotation) — token cũ bị thu hồi ngay khi dùng, kể cả khi bước sau đó
 * thất bại, để token bị đánh cắp không dùng lại được.
 *
 * Trạng thái account được kiểm tra lại tại thời điểm gia hạn: account bị vô
 * hiệu hoá sau khi đăng nhập thì không gia hạn được nữa.
 */
export default class RefreshSessionUseCase {
    public constructor(
        private readonly _accessTokenIssuer: AccessTokenIssuer,
        private readonly _accountRepo: AccountRepo,
        private readonly _refreshTokenStore: RefreshTokenStore,
    ) {}

    /**
     * @param input.refreshToken Refresh token client đang giữ.
     *
     * @returns Cặp access/refresh token mới của phiên.
     *
     * @throws {RefreshTokenInvalidError} Token không tồn tại, hết hạn hoặc đã thu hồi.
     * @throws {AccountNotVerifiedError}  Account chưa xác minh email.
     * @throws {AccountDeactivatedError}  Account đã bị vô hiệu hoá.
     */
    public async execute(input: RefreshSessionInput): Promise<AuthTokens> {
        const accountId = await this._refreshTokenStore.consume(input.refreshToken);
        if (accountId == undefined) {
            throw new RefreshTokenInvalidError();
        }

        const account = await this._accountRepo.getById(accountId);
        if (account == undefined) {
            // Account đã biến mất khỏi hệ thống — coi như token không còn giá trị.
            throw new RefreshTokenInvalidError();
        }

        account.ensureCanLogin();

        return issueAuthTokens(account.id, this._accessTokenIssuer, this._refreshTokenStore);
    }
}
