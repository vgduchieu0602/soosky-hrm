import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class EvaluationNotLockedError extends ApplicationError {
    readonly code       = "PAY_EVAL_NOT_LOCKED";
    readonly httpStatus = 409;

    constructor(periodName: string) {
        super(`Lock evaluations for period ${periodName} before running payroll`);
    }
}
