import AccessTokenVerifier, { AuthenticatedActor } from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Trình xác minh access token dạng JWT ký HS256, dùng chung secret với nơi
 * phát hành token (use-case Login của module Auth khi hoàn thiện).
 *
 * Token hợp lệ khi thoả tất cả điều kiện:
 * - đúng định dạng ba phần `header.payload.signature` (base64url);
 * - header khai báo `alg` là `HS256` (chặn `none`/thuật toán khác);
 * - chữ ký khớp secret (so sánh timing-safe);
 * - có `exp` (giây epoch) và chưa hết hạn;
 * - payload mang claim `userId` là chuỗi khác rỗng.
 *
 * Input không hợp lệ dưới bất kỳ dạng nào đều trả về `undefined`, không ném
 * lỗi. Khi module Auth có quản lý phiên (thu hồi qua `jti`, trạng thái tài
 * khoản), hiện thực này nên uỷ quyền thêm cho module Auth.
 */
export default class JwtAccessTokenVerifier implements AccessTokenVerifier {

    public constructor(
        private readonly _secret: string
    ) {}

    public async verify(accessToken: string): Promise<AuthenticatedActor | undefined> {
        try {
            const parts = accessToken.split(".");
            const [encodedHeader, encodedPayload, encodedSignature] = parts;
            if (parts.length !== 3 || encodedHeader == undefined || encodedPayload == undefined || encodedSignature == undefined) {
                return undefined;
            }

            const header = this._decodeJson(encodedHeader);
            if (header?.alg !== "HS256") {
                return undefined;
            }

            if (!this._isSignatureValid(`${encodedHeader}.${encodedPayload}`, encodedSignature)) {
                return undefined;
            }

            const payload    = this._decodeJson(encodedPayload);
            const userId     = payload?.userId;
            const nowSeconds = Math.floor(Date.now() / 1000);

            const isInvalid = payload == undefined
                || this._isExpired(payload, nowSeconds)
                || this._isInvalidUserId(userId)
                ;
            if (isInvalid)
                return undefined;

            // Claim vắng mặt (token phát hành trước khi có tính năng này) → false:
            // không chặn oan người đang có phiên hợp lệ.
            return new AuthenticatedActor(userId as string, payload.mustChangePassword === true);

        } catch {
            // Mọi lỗi parse/decode đều coi là token không hợp lệ.
            return undefined;
        }
    }

    /**
     * Decode một phần base64url của JWT thành object JSON; trả về `undefined`
     * nếu nội dung không phải object JSON hợp lệ.
     */
    private _decodeJson(encoded: string): Record<string, unknown> | undefined {
        const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
        return typeof decoded === "object" && decoded !== null ? decoded as Record<string, unknown> : undefined;
    }

    /**
     * So sánh chữ ký HMAC-SHA256 của `signingInput` với chữ ký đính kèm bằng
     * phép so sánh timing-safe.
     */
    private _isSignatureValid(signingInput: string, encodedSignature: string): boolean {
        const expected = createHmac("sha256", this._secret).update(signingInput).digest();
        const actual   = Buffer.from(encodedSignature, "base64url");
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    }

    /**
     * Kiểm tra xem token có hết hạn không (claim `exp`).
     */
    private _isExpired(payload: Record<string, unknown>, nowSeconds: number): boolean {
        return typeof payload.exp !== "number" || payload.exp <= nowSeconds;
    }

    /**
     * Kiểm tra xem User ID có hợp lệ không.
     */
    private _isInvalidUserId(userId: unknown): boolean {
        return typeof userId !== "string" || userId === "";
    }
}
