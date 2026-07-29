import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class EmployeeCodeConflictError extends ApplicationError {
    readonly code       = "EMPLOYEE_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Employee code already exists");
    }
}
