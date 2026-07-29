import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";

/**
 * Cổng quản lý token xác minh email (driven port).
 *
 * Token được phát hành lúc đăng ký, gửi cho chủ tài khoản qua email và đổi
 * lấy accountId đúng một lần khi xác minh. Hiện thực ở tầng hạ tầng tự quyết
 * định cách sinh token, TTL và cách lưu (vd: lưu dạng băm trong MongoDB kèm
 * TTL index).
 */
export default interface VerificationTokenStore {
    /**
     * Phát hành token xác minh mới cho account. Token thô chỉ dùng để gửi
     * qua email, không lưu lại phía server.
     */
    issue(accountId: string): Promise<IssuedToken>;

    /**
     * Đổi token lấy id account cần xác minh, đồng thời thu hồi token đó
     * (mỗi token chỉ dùng được đúng một lần).
     *
     * @returns Id account nếu token hợp lệ; `null` nếu token không tồn tại,
     *          đã hết hạn hoặc đã dùng rồi.
     */
    consume(token: string): Promise<string | null>;

    /**
     * Thu hồi toàn bộ token của một account (dùng khi xoá account pending...).
     */
    revokeAllForAccount(accountId: string): Promise<void>;
}
