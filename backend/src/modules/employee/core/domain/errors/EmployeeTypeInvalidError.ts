import DomainError from "@shared/core/domain/DomainError";

export default class EmployeeTypeInvalidError extends DomainError {
    readonly code       = "EMPLOYEE_TYPE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
