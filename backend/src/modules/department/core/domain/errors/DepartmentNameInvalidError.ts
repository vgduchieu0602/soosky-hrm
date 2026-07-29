import DomainError from "@shared/core/domain/DomainError";

export default class DepartmentNameInvalidError extends DomainError {
    readonly code       = "DEPARTMENT_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
