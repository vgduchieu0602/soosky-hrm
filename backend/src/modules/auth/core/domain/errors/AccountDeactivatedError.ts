import DomainError from "@shared/core/domain/DomainError";

export default class AccountDeactivatedError extends DomainError {
    readonly code = "ACCOUNT_DEACTIVATED";
    readonly httpStatus = 403;

    constructor() {
        super("Account is deactivated");
    }
}
