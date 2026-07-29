import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentCannotBeOwnParentError extends DomainError {
    readonly code       = "DEPARTMENT_CANNOT_BE_OWN_PARENT";
    readonly httpStatus = 409;

    constructor() {
        super("Department cannot be its own parent");
    }
}
