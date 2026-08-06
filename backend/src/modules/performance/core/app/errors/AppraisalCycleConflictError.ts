import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AppraisalCycleConflictError extends ApplicationError {
    readonly code       = "APPRAISAL_CYCLE_CONFLICT";
    readonly httpStatus = 409;

    constructor(payrollPeriodId: string) {
        super(`An appraisal cycle already exists for payroll period ${payrollPeriodId}`);
    }
}
