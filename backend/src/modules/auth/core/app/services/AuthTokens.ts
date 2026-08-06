import AccessTokenIssuer from "@modules/auth/core/app/ports/AccessTokenIssuer";
import Account from "@modules/auth/core/domain/entities/Account";
import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";

/**
 * Cặp token trả về cho client khi mở phiên mới (đăng nhập hoặc gia hạn).
 */
export interface AuthTokens {
    accessToken:           string;
    accessTokenExpiresAt:  Date;
    refreshToken:          string;
    refreshTokenExpiresAt: Date;
    /**
     * Trả thẳng cho client để giao diện điều hướng sang trang đổi mật khẩu ngay
     * sau khi đăng nhập, không phải chờ một request khác bị 403.
     */
    mustChangePassword:    boolean;
}

/**
 * Phát hành cặp token mới cho account — phần dùng chung của Login và
 * RefreshSession.
 */
export async function issueAuthTokens(
    account:           Account,
    accessTokenIssuer: AccessTokenIssuer,
    refreshTokenStore: RefreshTokenStore,
): Promise<AuthTokens> {
    const accessToken  = await accessTokenIssuer.issue(account.id, { mustChangePassword: account.mustChangePassword });
    const refreshToken = await refreshTokenStore.issue(account.id);

    return {
        accessToken:           accessToken.token,
        accessTokenExpiresAt:  accessToken.expiresAt,
        refreshToken:          refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expiresAt,
        mustChangePassword:    account.mustChangePassword,
    };
}
