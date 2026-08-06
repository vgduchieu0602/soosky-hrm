/**
 * Dạng document lưu trữ của aggregate `Account` trong module Auth.
 */
export default interface AccountDocument {
    _id:          string;
    email:        string;
    passwordHash: string;
    fullName:     string;
    role:         string;
    status:       string;
    verifiedAt:   Date | null;
    createdAt:    Date;
    /**
     * Vắng mặt trên document cũ (tạo trước khi có tính năng buộc đổi mật khẩu)
     * → mapper đọc thành `false`, không bắt người đang dùng đổi mật khẩu oan.
     */
    mustChangePassword?: boolean;
}
