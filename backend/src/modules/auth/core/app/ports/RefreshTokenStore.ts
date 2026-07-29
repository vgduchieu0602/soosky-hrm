import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";

/**
 * Cổng quản lý vòng đời refresh token (driven port).
 *
 * Khác với access token stateless, refresh token là stateful: được lưu phía
 * server nên thu hồi được. Hiện thực ở tầng hạ tầng tự quyết định cách sinh
 * token, TTL và cách lưu (vd: lưu dạng băm trong MongoDB kèm TTL index).
 */
export default interface RefreshTokenStore {
    /**
     * Phát hành refresh token mới cho account.
     */
    issue(accountId: string): Promise<IssuedToken>;

    /**
     * Đổi token lấy id account sở hữu, đồng thời thu hồi token đó (rotation —
     * mỗi refresh token chỉ dùng được đúng một lần).
     *
     * @returns Id account nếu token hợp lệ; `null` nếu token không tồn tại,
     *          đã hết hạn hoặc đã bị thu hồi.
     */
    consume(token: string): Promise<string | null>;

    /**
     * Thu hồi một token. Token không tồn tại thì bỏ qua (idempotent).
     */
    revoke(token: string): Promise<void>;

    /**
     * Thu hồi toàn bộ token của một account (dùng khi đổi mật khẩu, vô hiệu
     * hoá account...).
     */
    revokeAllForAccount(accountId: string): Promise<void>;
}
