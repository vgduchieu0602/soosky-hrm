/**
 * Danh tính đã xác thực của người gọi, phân giải từ access token.
 */
export class AuthenticatedActor {
    constructor(
        public readonly userId: string,
        /**
         * Account đang dùng mật khẩu TẠM → `authenticate` chặn mọi endpoint trừ
         * nhóm được phép (đổi mật khẩu, xem chính mình, đăng xuất).
         */
        public readonly mustChangePassword: boolean = false,
    ) {}
}

/**
 * Cổng xác minh access token mà HTTP adapter yêu cầu (driver-side port).
 *
 * Hiện thực cụ thể do composition root cung cấp (thường uỷ quyền cho module
 * Auth); adapter chỉ cần biết token có hợp lệ không và thuộc về user nào.
 */
export default interface AccessTokenVerifier {
    /**
     * @param accessToken Access token thô lấy từ header `Authorization`.
     *
     * @returns Danh tính actor nếu token hợp lệ, ngược lại `undefined`.
     */
    verify(accessToken: string): Promise<AuthenticatedActor | undefined>;
}
