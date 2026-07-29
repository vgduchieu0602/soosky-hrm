import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class EmployeeNotFoundError extends ApplicationError {
    readonly code       = "EMPLOYEE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Employee not found");
    }
}
