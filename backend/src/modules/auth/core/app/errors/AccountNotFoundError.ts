import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class AccountNotFoundError extends ApplicationError {
    readonly code = "ACCOUNT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Account not found");
    }
}
