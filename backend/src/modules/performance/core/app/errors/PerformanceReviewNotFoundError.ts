import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PerformanceReviewNotFoundError extends ApplicationError {
    readonly code       = "PERFORMANCE_REVIEW_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Performance review not found");
    }
}
