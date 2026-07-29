import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AccessDeniedError extends ApplicationError {
    readonly code = "ACCESS_DENIED";
    readonly httpStatus = 403;

    constructor() {
        super("Access denied");
    }
}
