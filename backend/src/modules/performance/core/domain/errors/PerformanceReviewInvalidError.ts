import DomainError from "@shared/core/domain/DomainError";

export default class PerformanceReviewInvalidError extends DomainError {
    readonly code       = "PERFORMANCE_REVIEW_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
