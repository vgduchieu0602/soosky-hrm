import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class DepartmentCodeConflictError extends ApplicationError {
    readonly code       = "DEPARTMENT_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Department code already exists");
    }
}
