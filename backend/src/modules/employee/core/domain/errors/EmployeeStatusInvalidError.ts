import DomainError from "@shared/core/domain/DomainError";

export default class EmployeeStatusInvalidError extends DomainError {
    readonly code       = "EMPLOYEE_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
