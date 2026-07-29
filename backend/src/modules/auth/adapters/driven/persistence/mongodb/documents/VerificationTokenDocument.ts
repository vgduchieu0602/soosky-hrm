/**
 * Dạng document lưu trữ của token xác minh email trong module Auth.
 *
 * `_id` là SHA-256 (hex) của token thô — token thô chỉ nằm trong email gửi
 * cho chủ tài khoản, không bao giờ chạm DB, nên dữ liệu bị lộ cũng không
 * dùng lại được token.
 */
export default interface VerificationTokenDocument {
    _id:       string;
    accountId: string;
    expiresAt: Date;
    createdAt: Date;
}
