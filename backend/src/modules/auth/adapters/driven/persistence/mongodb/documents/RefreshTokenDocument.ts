/**
 * Dạng document lưu trữ của refresh token trong module Auth.
 *
 * `_id` là SHA-256 (hex) của token thô — token thô chỉ nằm trong tay client,
 * không bao giờ chạm DB, nên dữ liệu bị lộ cũng không dùng lại được token.
 */
export default interface RefreshTokenDocument {
    _id:       string;
    accountId: string;
    expiresAt: Date;
    createdAt: Date;
}
