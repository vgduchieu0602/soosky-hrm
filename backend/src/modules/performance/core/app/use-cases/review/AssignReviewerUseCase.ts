import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";

export interface AssignReviewerInput {
    reviewId:       string;
    reviewerUserId: string;
    actorUserId:    string;
}

/**
 * HR đổi người chấm của một phiếu (quản lý nghỉ việc, đổi nhóm giữa chu kỳ, ...).
 *
 * @throws {AccessDeniedError}                Actor không có quyền `performance:manage`.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu đã qua bước duyệt.
 */
export default class AssignReviewerUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: AssignReviewerInput): Promise<void> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        const previous = review.reviewerUserId;
        review.assignReviewer(input.reviewerUserId);
        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "assign_reviewer",
            resourceId:  review.id,
            changes:     { employeeId: review.employeeId, before: previous, after: review.reviewerUserId },
        });
    }
}
