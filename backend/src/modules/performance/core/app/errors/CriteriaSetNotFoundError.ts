import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class CriteriaSetNotFoundError extends ApplicationError {
    readonly code       = "CRITERIA_SET_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Criteria set not found");
    }
}
