import DomainError from "@shared/core/domain/DomainError";

export default class FullNameInvalidError extends DomainError {
    readonly code = "FULL_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
