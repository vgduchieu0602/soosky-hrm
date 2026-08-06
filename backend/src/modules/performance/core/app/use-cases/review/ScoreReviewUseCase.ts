import AppraisalCycleNotFoundError from "@modules/performance/core/app/errors/AppraisalCycleNotFoundError";
import CriteriaSetNotFoundError from "@modules/performance/core/app/errors/CriteriaSetNotFoundError";
import CriteriaVersionNotFoundError from "@modules/performance/core/app/errors/CriteriaVersionNotFoundError";
import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import CriteriaSetRepo from "@modules/performance/core/app/ports/CriteriaSetRepo";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import { CriterionScore, ReviewTotals } from "@modules/performance/core/domain/entities/PerformanceReview";
import AppraisalCycleInvalidError from "@modules/performance/core/domain/errors/AppraisalCycleInvalidError";
import { computeReviewTotals } from "@modules/performance/core/domain/services/score-calc";

export interface ScoreReviewInput {
    reviewId: string;
    scores:   CriterionScore[];
    managerNote?: string | undefined;
    strengths?: string | undefined;
    improvements?: string | undefined;
    developmentPlan?: string | undefined;
    actorUserId: string;
}

export interface ScoreReviewOutput {
    reviewId: string;
    totals:   ReviewTotals;
}

/**
 * Người chấm (quản lý trực tiếp, hoặc HR) nhập điểm từng tiêu chí + nhận xét.
 *
 * Điểm tổng hợp (kpi/goal/performance) do BACKEND tính từ trọng số của đúng
 * phiên bản tiêu chí mà phiếu đang dùng — không nhận từ client. Nếu tin client
 * thì ba con số đi vào lương có thể không khớp với điểm từng tiêu chí, và không
 * cách nào kiểm lại.
 *
 * Nộp lại được nhiều lần khi phiếu còn `draft`/`submitted` (sửa trước khi HR duyệt).
 *
 * @throws {AccessDeniedError}                 Actor không được chấm cho nhân viên này (kể cả tự chấm).
 * @throws {PerformanceReviewNotFoundError}    Phiếu không tồn tại.
 * @throws {AppraisalCycleNotFoundError}       Chu kỳ của phiếu không tồn tại.
 * @throws {AppraisalCycleInvalidError}        Chu kỳ chưa mở hoặc đã đóng.
 * @throws {CriteriaVersionNotFoundError}      Phiên bản tiêu chí của phiếu không còn.
 * @throws {PerformanceReviewInvalidError}     Thiếu điểm tiêu chí, điểm ngoài thang 0..100.
 * @throws {PerformanceReviewTransitionError}  Phiếu đã duyệt/khoá.
 */
export default class ScoreReviewUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _cycleRepo: AppraisalCycleRepo,
        private readonly _criteriaSetRepo: CriteriaSetRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: ScoreReviewInput): Promise<ScoreReviewOutput> {
        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        // Kiểm quyền SAU khi đọc phiếu: phải biết phiếu của ai mới xét được phạm vi.
        await this._accessScope.assertCanScore(input.actorUserId, review.employeeId);

        const cycle = await this._cycleRepo.getById(review.cycleId);
        if (cycle == undefined) throw new AppraisalCycleNotFoundError();
        if (!cycle.isActive) throw new AppraisalCycleInvalidError(`Cycle is ${cycle.status}, not accepting scores`);

        // Đọc tiêu chí theo phiên bản GHI TRÊN PHIẾU, không phải bản mới nhất:
        // đó là điều làm cho việc phát hành tiêu chí mới không đổi nghĩa điểm cũ.
        const criteriaSet = await this._criteriaSetRepo.getById(review.criteriaSetId);
        if (criteriaSet == undefined) throw new CriteriaSetNotFoundError();

        const version = criteriaSet.getVersion(review.criteriaVersion);
        if (version == undefined) throw new CriteriaVersionNotFoundError(review.criteriaVersion);

        const totals = computeReviewTotals(version.criteria, input.scores);

        review.score({
            scores: input.scores,
            totals,
            managerNote:     input.managerNote,
            strengths:       input.strengths,
            improvements:    input.improvements,
            developmentPlan: input.developmentPlan,
        });

        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "score",
            resourceId:  review.id,
            changes:     {
                employeeId: review.employeeId, cycleId: review.cycleId,
                criteriaVersion: review.criteriaVersion, totals,
            },
        });

        return { reviewId: review.id, totals };
    }
}
