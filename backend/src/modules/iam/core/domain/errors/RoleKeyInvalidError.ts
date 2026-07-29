import DomainError from "@shared/core/domain/DomainError";

export default class RoleKeyInvalidError extends DomainError {
    readonly code = "ROLE_KEY_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
