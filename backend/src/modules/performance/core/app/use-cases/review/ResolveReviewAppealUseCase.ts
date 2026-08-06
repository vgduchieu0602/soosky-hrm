import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";

export interface ResolveReviewAppealInput {
    reviewId: string;
    /** Trả lời của HR — BẮT BUỘC. */
    hrNote:   string;
    /** true = trả phiếu về cho người chấm chấm lại; false = giữ nguyên điểm. */
    rescore:  boolean;
    actorUserId: string;
}

/**
 * HR xử lý khiếu nại: cho chấm lại, hoặc giữ nguyên điểm và coi như đã trả lời.
 *
 * Lý do khiếu nại của nhân viên KHÔNG bị xoá khi xử lý — cả hai phía đều còn dấu
 * vết trên phiếu, đó là điều cần khi có tranh chấp về sau.
 *
 * @throws {AccessDeniedError}                Actor không có quyền `performance:manage`.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu không ở trạng thái khiếu nại.
 * @throws {PerformanceReviewInvalidError}    Thiếu trả lời của HR.
 */
export default class ResolveReviewAppealUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: ResolveReviewAppealInput): Promise<void> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        review.resolveAppeal(input.hrNote, input.rescore);
        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "resolve_appeal",
            resourceId:  review.id,
            changes:     {
                employeeId: review.employeeId, rescore: input.rescore,
                appealNote: review.appealNote, hrNote: review.hrNote, statusAfter: review.status,
            },
        });
    }
}
