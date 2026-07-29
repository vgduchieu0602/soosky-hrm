import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Middleware CORS tối giản, không cần dependency ngoài — đủ cho client dùng
 * bearer token qua header `Authorization` (không cookie nên không bật
 * `Access-Control-Allow-Credentials`).
 *
 * Origin nằm trong danh sách cho phép (hoặc danh sách chứa `*`) thì được echo
 * lại vào `Access-Control-Allow-Origin`; preflight `OPTIONS` được trả 204
 * ngay tại đây. Origin lạ thì bỏ qua, không gắn header — trình duyệt tự chặn.
 */
export default function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
    const allowAll = allowedOrigins.includes("*");

    return function(req: Request, res: Response, next: NextFunction): void {
        const origin = req.headers.origin;

        if (origin == undefined || (!allowAll && !allowedOrigins.includes(origin))) {
            next();
            return;
        }

        res.setHeader("Access-Control-Allow-Origin", origin);
        // Response phụ thuộc Origin — báo cache trung gian không dùng chéo.
        res.vary("Origin");

        if (req.method === "OPTIONS") {
            const requestedHeaders = req.headers["access-control-request-headers"];
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
            res.setHeader(
                "Access-Control-Allow-Headers",
                requestedHeaders != undefined && requestedHeaders !== ""
                    ? requestedHeaders
                    : "Content-Type, Authorization",
            );
            res.setHeader("Access-Control-Max-Age", "86400");
            res.status(204).end();
            return;
        }

        next();
    };
}
