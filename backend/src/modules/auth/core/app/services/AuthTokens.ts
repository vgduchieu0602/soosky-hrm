import AccessTokenIssuer from "@modules/auth/core/app/ports/AccessTokenIssuer";
import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";

/**
 * Cặp token trả về cho client khi mở phiên mới (đăng nhập hoặc gia hạn).
 */
export interface AuthTokens {
    accessToken:           string;
    accessTokenExpiresAt:  Date;
    refreshToken:          string;
    refreshTokenExpiresAt: Date;
}

/**
 * Phát hành cặp token mới cho account — phần dùng chung của Login và
 * RefreshSession.
 */
export async function issueAuthTokens(
    accountId:         string,
    accessTokenIssuer: AccessTokenIssuer,
    refreshTokenStore: RefreshTokenStore,
): Promise<AuthTokens> {
    const accessToken  = await accessTokenIssuer.issue(accountId);
    const refreshToken = await refreshTokenStore.issue(accountId);

    return {
        accessToken:           accessToken.token,
        accessTokenExpiresAt:  accessToken.expiresAt,
        refreshToken:          refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expiresAt,
    };
}
