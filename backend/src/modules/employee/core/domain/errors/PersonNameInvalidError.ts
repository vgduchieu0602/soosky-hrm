import DomainError from "@shared/core/domain/DomainError";

export default class PersonNameInvalidError extends DomainError {
    readonly code       = "PERSON_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
