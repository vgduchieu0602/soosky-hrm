import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class AccountNotDeletableError extends ApplicationError {
    readonly code = "ACCOUNT_NOT_DELETABLE";
    readonly httpStatus = 409;

    constructor() {
        super("Only pending accounts can be deleted");
    }
}
