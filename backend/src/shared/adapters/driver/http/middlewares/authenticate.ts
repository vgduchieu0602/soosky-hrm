import ActorContext from "@shared/adapters/driver/http/ActorContext";
import PasswordChangeRequiredError from "@shared/adapters/driver/http/errors/PasswordChangeRequiredError";
import UnauthorizedError from "@shared/adapters/driver/http/errors/UnauthorizedError";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { RequestHandler } from "express";

const BEARER_PREFIX = "Bearer ";

export interface AuthenticateOptions {
    /**
     * Cho phép đi qua dù account còn phải đổi mật khẩu tạm. CHỈ dùng cho đúng
     * nhóm endpoint cần thiết để hoàn tất bước đó (đổi mật khẩu, xem hồ sơ
     * chính mình, đăng xuất) — thiếu nó thì người dùng bị kẹt: không gọi được
     * API nào, kể cả API để tự thoát ra.
     */
    allowPendingPasswordChange?: boolean;
}

/**
 * Middleware xác thực Bearer token cho mọi endpoint của module.
 *
 * Đọc header `Authorization`, nhờ `AccessTokenVerifier` phân giải token thành
 * danh tính actor rồi lưu vào `ActorContext`; token thiếu hoặc không hợp lệ
 * → 401 UNAUTHORIZED.
 *
 * CHẶN MẶC ĐỊNH với mật khẩu tạm: account chưa đổi mật khẩu ban đầu thì mọi
 * endpoint khác trả 403 `PASSWORD_CHANGE_REQUIRED`. Chặn ở đây an toàn hơn để
 * từng router tự nhớ kiểm tra — module mới thêm vào là tự động được bảo vệ,
 * muốn mở thì phải khai báo tường minh.
 */
export default function authenticate(verifier: AccessTokenVerifier, options: AuthenticateOptions = {}): RequestHandler {
    return async (req, res, next) => {
        const header = req.headers.authorization;
        if (header == undefined || header.startsWith(BEARER_PREFIX) == false) {
            throw new UnauthorizedError();
        }

        const actor = await verifier.verify(header.slice(BEARER_PREFIX.length));
        if (actor == undefined) throw new UnauthorizedError();

        if (actor.mustChangePassword && options.allowPendingPasswordChange !== true) {
            throw new PasswordChangeRequiredError();
        }

        ActorContext.set(res, actor.userId);
        next();
    };
}
