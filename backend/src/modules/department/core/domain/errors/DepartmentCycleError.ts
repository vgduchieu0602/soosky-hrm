import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentCycleError extends DomainError {
    readonly code       = "DEPARTMENT_CYCLE";
    readonly httpStatus = 409;

    constructor() {
        super("Cannot move a department under its own descendant");
    }
}
