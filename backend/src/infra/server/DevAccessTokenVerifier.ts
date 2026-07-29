import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";

/**
 * Trình xác minh token TẠM THỜI cho môi trường phát triển: coi chính chuỗi
 * token là userId (`Authorization: Bearer <userId>`), không kiểm tra gì thêm.
 *
 * KHÔNG dùng cho production — thay bằng hiện thực uỷ quyền cho module Auth
 * khi module này hoàn thiện.
 */
export default class DevAccessTokenVerifier implements AccessTokenVerifier {
    public async verify(accessToken: string): Promise<AuthenticatedActor | undefined> {
        const userId = accessToken.trim();
        return userId === "" ? undefined : new AuthenticatedActor(userId);
    }
}
