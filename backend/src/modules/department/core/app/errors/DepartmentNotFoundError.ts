import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class DepartmentNotFoundError extends ApplicationError {
    readonly code       = "DEPARTMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Department not found");
    }
}
