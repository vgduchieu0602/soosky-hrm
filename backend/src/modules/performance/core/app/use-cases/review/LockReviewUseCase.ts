import AppraisalCycleNotFoundError from "@modules/performance/core/app/errors/AppraisalCycleNotFoundError";
import PerformanceReviewNotFoundError from "@modules/performance/core/app/errors/PerformanceReviewNotFoundError";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import PayrollEvaluationSink from "@modules/performance/core/app/ports/PayrollEvaluationSink";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import { ReviewTotals } from "@modules/performance/core/domain/entities/PerformanceReview";

export interface LockReviewInput {
    reviewId:    string;
    actorUserId: string;
}

export interface LockReviewOutput {
    reviewId: string;
    totals:   ReviewTotals;
}

/**
 * HR KHOÁ điểm — bước duy nhất đẩy điểm sang bảng lương.
 *
 * Thứ tự CỐ Ý: chụp sang Payroll TRƯỚC, lưu trạng thái `locked` SAU. Nếu chụp
 * thất bại (kỳ lương đã chốt đánh giá) thì phiếu vẫn ở `acknowledged` để khoá
 * lại — thà còn việc phải làm còn hơn có phiếu mang dấu "đã khoá" mà bảng lương
 * không hề có điểm.
 *
 * Sau khi khoá, phiếu bất biến. Payroll giữ BẢN CHỤP riêng, nên chấm lại hay
 * phát hành phiên bản tiêu chí mới về sau không làm đổi lương đã tính.
 *
 * @throws {AccessDeniedError}                Actor không có quyền `performance:manage`.
 * @throws {PerformanceReviewNotFoundError}   Phiếu không tồn tại.
 * @throws {AppraisalCycleNotFoundError}      Chu kỳ của phiếu không tồn tại.
 * @throws {PerformanceReviewTransitionError} Phiếu chưa được nhân viên xác nhận.
 * @throws {ApplicationError}                 Kỳ lương đã chốt đánh giá, không nhận bản chụp.
 */
export default class LockReviewUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _cycleRepo: AppraisalCycleRepo,
        private readonly _payrollSink: PayrollEvaluationSink,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: LockReviewInput): Promise<LockReviewOutput> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const review = await this._reviewRepo.getById(input.reviewId);
        if (review == undefined) throw new PerformanceReviewNotFoundError();

        const cycle = await this._cycleRepo.getById(review.cycleId);
        if (cycle == undefined) throw new AppraisalCycleNotFoundError();

        // Đổi trạng thái trong bộ nhớ trước (để chặn ngay phiếu chưa xác nhận),
        // nhưng chỉ LƯU sau khi bản chụp đã sang Payroll thành công.
        const totals = review.lock(input.actorUserId);

        await this._payrollSink.snapshotEvaluation({
            payrollPeriodId:  cycle.payrollPeriodId,
            employeeId:       review.employeeId,
            performanceScore: totals.performanceScore,
            goalScore:        totals.goalScore,
            updatedBy:        input.actorUserId,
        });

        await this._reviewRepo.save(review);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_review",
            action:      "lock",
            resourceId:  review.id,
            changes:     {
                employeeId:      review.employeeId,
                cycleId:         review.cycleId,
                payrollPeriodId: cycle.payrollPeriodId,
                criteriaSetId:   review.criteriaSetId,
                criteriaVersion: review.criteriaVersion,
                snapshot:        totals,
            },
        });

        return { reviewId: review.id, totals };
    }
}
