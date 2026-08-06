import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

export interface AppealReviewInput {
    reviewId: string;
    /** Lý do khiếu nại — BẮT BUỘC, giữ lại vĩnh viễn trên phiếu. */
    reason:   string;
    actorUserId: string;
}

/**
 * Nhân viên khiếu nại phiếu của CHÍNH MÌNH thay vì xác nhận.
 *
 * @throws {AccessDeniedError}                Phiếu không thuộc actor.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu chưa được HR duyệt.
 * @throws {PerformanceReviewInvalidError}    Thiếu lý do khiếu nại.
 */
export default class AppealReviewUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: AppealReviewInput): Promise<void> {
        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        const ownEmployeeId = await this._accessScope.requireOwnEmployeeId(input.actorUserId);
        if (ownEmployeeId !== review.employeeId) throw new AccessDeniedError();

        review.appeal(input.reason);
        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "appeal",
            resourceId:  review.id,
            changes:     { employeeId: review.employeeId, appealNote: review.appealNote, totals: review.totals },
        });
    }
}
