import DomainError from "@shared/core/domain/DomainError";

export default class EmailInvalidError extends DomainError {
    readonly code = "EMAIL_INVALID";
    readonly httpStatus = 422;

    constructor(raw: string) {
        super(`Invalid email: ${raw}`);
    }
}
