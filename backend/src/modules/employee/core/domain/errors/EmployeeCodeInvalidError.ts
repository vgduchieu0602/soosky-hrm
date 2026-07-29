import DomainError from "@shared/core/domain/DomainError";

export default class EmployeeCodeInvalidError extends DomainError {
    readonly code       = "EMPLOYEE_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
