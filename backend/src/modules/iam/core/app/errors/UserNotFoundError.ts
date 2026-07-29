import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class UserNotFoundError extends ApplicationError {
    readonly code = "USER_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("User not found");
    }
}
