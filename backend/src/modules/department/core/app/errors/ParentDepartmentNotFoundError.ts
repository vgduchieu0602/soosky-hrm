import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ParentDepartmentNotFoundError extends ApplicationError {
    readonly code       = "PARENT_DEPARTMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Parent department not found");
    }
}
