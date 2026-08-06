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
/**
 * Claim nghiệp vụ nhúng vào access token ngoài `userId`.
 *
 * Nhúng thay vì tra DB mỗi request: middleware `authenticate` chạy trước mọi
 * module và không được phép phụ thuộc vào module Auth. Access token ngắn hạn
 * (15 phút) nên độ trễ khi cờ thay đổi là chấp nhận được — và ở luồng đổi mật
 * khẩu thì mọi refresh token đều bị thu hồi, buộc lấy token mới ngay.
 */
export interface AccessTokenClaims {
    mustChangePassword: boolean;
}

export default interface AccessTokenIssuer {
    issue(accountId: string, claims: AccessTokenClaims): Promise<IssuedToken>;
}
