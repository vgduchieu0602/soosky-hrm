import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class DepartmentHasChildrenError extends ApplicationError {
    readonly code       = "DEPARTMENT_HAS_CHILDREN";
    readonly httpStatus = 409;

    constructor(message: string = "Department still has dependent records") {
        super(message);
    }
}
