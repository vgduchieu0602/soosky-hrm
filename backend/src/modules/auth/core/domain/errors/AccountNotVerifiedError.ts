import DomainError from "@shared/core/domain/DomainError";

export default class AccountNotVerifiedError extends DomainError {
    readonly code = "EMAIL_NOT_VERIFIED";
    readonly httpStatus = 403;

    constructor() {
        super("Email address has not been verified");
    }
}
