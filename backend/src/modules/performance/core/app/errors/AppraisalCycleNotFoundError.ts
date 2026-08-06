import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AppraisalCycleNotFoundError extends ApplicationError {
    readonly code       = "APPRAISAL_CYCLE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Appraisal cycle not found");
    }
}
