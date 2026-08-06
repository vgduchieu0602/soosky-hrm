import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";

export interface RequestReviewChangesInput {
    reviewId: string;
    /** Lý do BẮT BUỘC: người chấm cần biết phải sửa gì. */
    hrNote:   string;
    actorUserId: string;
}

/**
 * HR trả phiếu về `draft` để người chấm làm lại.
 *
 * @throws {AccessDeniedError}                Actor không có quyền `performance:manage`.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu đã khoá.
 * @throws {PerformanceReviewInvalidError}    Thiếu lý do.
 */
export default class RequestReviewChangesUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: RequestReviewChangesInput): Promise<void> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        review.requestChanges(input.hrNote);
        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "request_changes",
            resourceId:  review.id,
            changes:     { employeeId: review.employeeId, hrNote: review.hrNote },
        });
    }
}
