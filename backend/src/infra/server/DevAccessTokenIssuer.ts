import AccessTokenIssuer, { AccessTokenClaims } from "@modules/auth/core/app/ports/AccessTokenIssuer";
import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";

const TTL_MS = 15 * 60 * 1000; // 15 phút, khớp TTL mặc định của JwtAccessTokenIssuer

/**
 * Trình phát hành token TẠM THỜI cho môi trường phát triển: token chính là
 * accountId — đối xứng với `DevAccessTokenVerifier` (`Bearer <userId>`), nên
 * đăng nhập không cần `AUTH_JWT_SECRET` vẫn dùng được token trả về.
 *
 * KHÔNG dùng cho production — config đã chặn (`AUTH_JWT_SECRET` bắt buộc).
 */
export default class DevAccessTokenIssuer implements AccessTokenIssuer {

    public async issue(accountId: string, claims: AccessTokenClaims): Promise<IssuedToken> {
        // Token dev không mang được claim (token = accountId), nên chế độ dev
        // KHÔNG enforce được buộc đổi mật khẩu. Cảnh báo để không ai tưởng đã
        // kiểm thử xong luồng đó bằng token dev.
        if (claims.mustChangePassword) {
            console.warn("DevAccessTokenIssuer: mustChangePassword khong the nhung vao token dev — buoc doi mat khau se KHONG duoc enforce.");
        }
        return {
            token:     accountId,
            expiresAt: new Date(Date.now() + TTL_MS),
        };
    }
}
