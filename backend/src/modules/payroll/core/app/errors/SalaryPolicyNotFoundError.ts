import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class SalaryPolicyNotFoundError extends ApplicationError {
    readonly code       = "SALARY_POLICY_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("No salary policy in effect for the given date");
    }
}
