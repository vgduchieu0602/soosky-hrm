import DomainError from "@shared/core/domain/DomainError";

export default class RoleNameInvalidError extends DomainError {
    readonly code = "ROLE_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
