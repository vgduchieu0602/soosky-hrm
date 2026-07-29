import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentStatusInvalidError extends DomainError {
    readonly code       = "DEPARTMENT_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
