import HttpRequestError from "@shared/adapters/driver/http/errors/HttpRequestError";

export default class UnauthorizedError extends HttpRequestError {
    readonly code = "UNAUTHORIZED";
    readonly httpStatus = 401;

    constructor() {
        super("Missing or invalid access token");
    }
}
