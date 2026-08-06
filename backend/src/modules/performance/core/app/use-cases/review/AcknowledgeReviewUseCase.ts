import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

export interface AcknowledgeReviewInput {
    reviewId:    string;
    actorUserId: string;
}

/**
 * Nhân viên xác nhận phiếu của CHÍNH MÌNH.
 *
 * Cố tình không cho HR xác nhận thay: xác nhận là hành vi của người được đánh
 * giá, ký thay thì mất hết ý nghĩa. HR bị "kẹt" vì nhân viên không xác nhận thì
 * xử lý bằng quy trình hành chính, không phải bằng cách bấm hộ.
 *
 * @throws {AccessDeniedError}                Phiếu không thuộc actor.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu chưa được HR duyệt.
 */
export default class AcknowledgeReviewUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: AcknowledgeReviewInput): Promise<void> {
        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        const ownEmployeeId = await this._accessScope.requireOwnEmployeeId(input.actorUserId);
        if (ownEmployeeId !== review.employeeId) throw new AccessDeniedError();

        review.acknowledge();
        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "acknowledge",
            resourceId:  review.id,
            changes:     { employeeId: review.employeeId, totals: review.totals },
        });
    }
}
