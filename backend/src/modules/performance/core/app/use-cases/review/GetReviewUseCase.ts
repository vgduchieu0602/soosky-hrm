import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import PerformanceReview from "@modules/performance/core/domain/entities/PerformanceReview";

export interface GetReviewInput {
    reviewId:    string;
    actorUserId: string;
}

/**
 * Chi tiết một phiếu, trong phạm vi actor được xem.
 *
 * @throws {PerformanceReviewNotFoundError} Phiếu không tồn tại.
 * @throws {AccessDeniedError}              Phiếu thuộc nhân viên ngoài phạm vi.
 */
export default class GetReviewUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
    ) {}

    public async execute(input: GetReviewInput): Promise<PerformanceReview> {
        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        await this._accessScope.assertCanRead(input.actorUserId, review.employeeId);
        return review;
    }
}
