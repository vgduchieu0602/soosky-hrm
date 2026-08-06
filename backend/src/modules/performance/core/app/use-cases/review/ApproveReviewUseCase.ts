import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";

export interface ApproveReviewInput {
    reviewId: string;
    hrNote?: string | undefined;
    actorUserId: string;
}

/**
 * HR duyệt phiếu đã chấm. Chỉ `performance:manage` — quản lý chấm nhưng KHÔNG
 * tự duyệt phiếu nhóm mình, để điểm đi vào lương luôn có hai người xem qua.
 *
 * @throws {AccessDeniedError}                Actor không có quyền `performance:manage`.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu chưa được chấm, hoặc đã khoá.
 */
export default class ApproveReviewUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: ApproveReviewInput): Promise<void> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        review.approve(input.actorUserId, input.hrNote ?? null);
        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "approve",
            resourceId:  review.id,
            changes:     { employeeId: review.employeeId, totals: review.totals, hrNote: review.hrNote },
        });
    }
}
