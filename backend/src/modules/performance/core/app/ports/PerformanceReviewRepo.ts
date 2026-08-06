import PerformanceReview, { ReviewStatus } from "@modules/performance/core/domain/entities/PerformanceReview";

export interface ReviewListFilter {
    cycleId?: string | undefined;
    /** Thu hẹp theo phạm vi quyền (`team`/`self`); mảng rỗng → không trả gì. */
    employeeIds?: readonly string[] | undefined;
    status?: ReviewStatus | undefined;
    reviewerUserId?: string | undefined;
}

export default interface PerformanceReviewRepo {
    getById(id: string): Promise<PerformanceReview | undefined>;
    findOne(cycleId: string, employeeId: string): Promise<PerformanceReview | undefined>;
    list(filter: ReviewListFilter): Promise<PerformanceReview[]>;
    listByCycle(cycleId: string): Promise<PerformanceReview[]>;
    save(review: PerformanceReview): Promise<void>;
}
