import ApplicationError from "@shared/core/app/errors/ApplicationError";

/** Bản ghi sub-resource (contact, bank-account, document, contract, asset) không tồn tại. */
export default class EmployeeSubResourceNotFoundError extends ApplicationError {
    readonly code       = "EMPLOYEE_SUB_RESOURCE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Employee sub-resource not found");
    }
}
