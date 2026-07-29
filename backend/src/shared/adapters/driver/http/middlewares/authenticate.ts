import ActorContext from "@shared/adapters/driver/http/ActorContext";
import UnauthorizedError from "@shared/adapters/driver/http/errors/UnauthorizedError";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { RequestHandler } from "express";

const BEARER_PREFIX = "Bearer ";

/**
 * Middleware xác thực Bearer token cho mọi endpoint của module.
 *
 * Đọc header `Authorization`, nhờ `AccessTokenVerifier` phân giải token thành
 * danh tính actor rồi lưu vào `ActorContext`; token thiếu hoặc không hợp lệ
 * → 401 UNAUTHORIZED.
 */
export default function authenticate(verifier: AccessTokenVerifier): RequestHandler {
    return async (req, res, next) => {
        const header = req.headers.authorization;
        if (header == undefined || header.startsWith(BEARER_PREFIX) == false) {
            throw new UnauthorizedError();
        }

        const actor = await verifier.verify(header.slice(BEARER_PREFIX.length));
        if (actor == undefined) throw new UnauthorizedError();

        ActorContext.set(res, actor.userId);
        next();
    };
}
