import HttpRequestError from "@shared/adapters/driver/http/errors/HttpRequestError";

export default class BadRequestError extends HttpRequestError {
    readonly code = "INVALID_REQUEST";
    readonly httpStatus = 400;

    constructor(message?: string) {
        super(message || "Bad request");
    }
}
