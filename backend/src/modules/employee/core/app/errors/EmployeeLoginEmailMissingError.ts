import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class EmployeeLoginEmailMissingError extends ApplicationError {
    readonly code       = "EMPLOYEE_LOGIN_EMAIL_MISSING";
    readonly httpStatus = 422;

    constructor() {
        super("Employee has no email address to send login credentials to");
    }
}
