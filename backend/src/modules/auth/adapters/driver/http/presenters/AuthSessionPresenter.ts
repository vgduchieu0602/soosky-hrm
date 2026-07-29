import { AuthTokens } from "@modules/auth/core/app/services/AuthTokens";

/**
 * Thân response cho các endpoint mở phiên (docs/api.html § Session): client
 * chỉ cần hạn của access token để biết khi nào phải refresh; hạn của refresh
 * token là chuyện nội bộ phía server.
 */
export interface AuthSessionDTO {
    accessToken:     string;
    refreshToken:    string;
    accessExpiresAt: string;
}

const AuthSessionPresenter = {
    toDTO(tokens: AuthTokens): AuthSessionDTO {
        return {
            accessToken:     tokens.accessToken,
            refreshToken:    tokens.refreshToken,
            accessExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
        };
    },
};

export default AuthSessionPresenter;
