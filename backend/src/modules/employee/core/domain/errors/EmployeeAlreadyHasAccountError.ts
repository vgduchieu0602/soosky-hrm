import DomainError from "@shared/core/domain/DomainError";

export default class EmployeeAlreadyHasAccountError extends DomainError {
    readonly code       = "EMPLOYEE_ALREADY_HAS_ACCOUNT";
    readonly httpStatus = 409;

    constructor() {
        super("Employee is already linked to a login account");
    }
}
