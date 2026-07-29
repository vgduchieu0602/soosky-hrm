import DomainError from "@shared/core/domain/DomainError";

export default class PasswordInvalidError extends DomainError {
    readonly code = "PASSWORD_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
