import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class CredentialsInvalidError extends ApplicationError {
    readonly code = "CREDENTIALS_INVALID";
    readonly httpStatus = 401;

    constructor() {
        super("Email or password is incorrect");
    }
}
