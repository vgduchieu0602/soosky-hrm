import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";

export interface LogoutInput {
    refreshToken: string;
}

/**
 * Đăng xuất: thu hồi refresh token của phiên hiện tại.
 *
 * Idempotent: token không tồn tại hoặc đã thu hồi thì bỏ qua — client chỉ cần
 * biết chắc chắn token không còn dùng lại được. Access token đang lưu hành
 * vẫn có hiệu lực tới khi tự hết hạn (TTL ngắn), vì access token là stateless
 * và không thu hồi được.
 */
export default class LogoutUseCase {
    public constructor(
        private readonly _refreshTokenStore: RefreshTokenStore,
    ) {}

    /**
     * @param input.refreshToken Refresh token của phiên cần đăng xuất.
     */
    public async execute(input: LogoutInput): Promise<void> {
        await this._refreshTokenStore.revoke(input.refreshToken);
    }
}
