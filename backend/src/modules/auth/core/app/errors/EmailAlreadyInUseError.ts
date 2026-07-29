import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class EmailAlreadyInUseError extends ApplicationError {
    readonly code = "EMAIL_ALREADY_IN_USE";
    readonly httpStatus = 409;

    constructor() {
        super("Email is already registered");
    }
}
