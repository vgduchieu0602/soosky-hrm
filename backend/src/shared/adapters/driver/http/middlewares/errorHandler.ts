import ApplicationError from "@shared/core/app/errors/ApplicationError";
import DomainError from "@shared/core/domain/DomainError";
import HttpRequestError from "@shared/adapters/driver/http/errors/HttpRequestError";
import { ErrorRequestHandler } from "express";

/**
 * Dịch lỗi thành HTTP response ở cuối chuỗi middleware.
 *
 * Lỗi domain/application/adapter đều tự khai báo `code` + `httpStatus` nên chỉ
 * cần chiếu thẳng sang thân lỗi `{ code, message }` theo quy ước của API
 * (xem docs/api.html). Lỗi không nhận diện được trả 500 và không lộ chi tiết
 * nội bộ ra ngoài.
 */
const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }

    if (error instanceof HttpRequestError
        || error instanceof ApplicationError
        || error instanceof DomainError
    ) {
        res.status(error.httpStatus).json({ code: error.code, message: error.message });
        return;
    }

    if (isBodyParseError(error)) {
        res.status(400).json({ code: "INVALID_REQUEST", message: "Request body is not valid JSON" });
        return;
    }

    console.error(error);
    res.status(500).json({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
};

/**
 * Nhận diện lỗi của `express.json()` khi body không phải JSON hợp lệ.
 */
function isBodyParseError(error: unknown): boolean {
    return error instanceof SyntaxError
        && (error as { type?: string }).type === "entity.parse.failed";
}

export default errorHandler;
