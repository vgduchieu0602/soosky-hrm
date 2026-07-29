import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";

/**
 * Cổng phát hành access token (driven port).
 *
 * Hiện thực ở tầng hạ tầng — JWT HS256 mang claim `userId` + `exp`, ký chung
 * secret với `JwtAccessTokenVerifier` phía HTTP adapter.
 *
 * Access token là stateless: ngắn hạn, không lưu phía server nên không thu hồi
 * được; vòng đời phiên dài hạn do refresh token đảm nhiệm.
 */
export default interface AccessTokenIssuer {
    issue(accountId: string): Promise<IssuedToken>;
}
