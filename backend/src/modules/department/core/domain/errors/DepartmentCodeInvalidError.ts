import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentCodeInvalidError extends DomainError {
    readonly code       = "DEPARTMENT_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
