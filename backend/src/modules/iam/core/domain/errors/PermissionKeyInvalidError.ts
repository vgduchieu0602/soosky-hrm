import DomainError from "@shared/core/domain/DomainError";

export default class PermissionKeyInvalidError extends DomainError {
    readonly code = "PERMISSION_KEY_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
