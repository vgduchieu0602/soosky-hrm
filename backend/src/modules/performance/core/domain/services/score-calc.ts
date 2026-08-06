import { Criterion } from "@modules/performance/core/domain/entities/CriteriaSet";
import { CriterionScore, ReviewTotals } from "@modules/performance/core/domain/entities/PerformanceReview";
import PerformanceReviewInvalidError from "@modules/performance/core/domain/errors/PerformanceReviewInvalidError";

/**
 * Tổng hợp điểm từng tiêu chí thành ba con số theo nhóm (kpi/goal/performance):
 * bình quân GIA QUYỀN trong từng nhóm, thang 0..100.
 *
 * Thuần, không phụ thuộc hạ tầng, để tính lại từ cùng dữ liệu luôn ra cùng kết
 * quả — đó là điều kiện để điểm đã khoá kiểm tra lại được.
 *
 * Nhóm KHÔNG có tiêu chí nào trong phiên bản → điểm 100. Vì sao 100 chứ không
 * phải 0: công ty không đặt tiêu chí cho nhóm đó nghĩa là không đánh giá theo
 * nhóm đó, và bảng lương nhân trực tiếp tỉ lệ này — trả 0 sẽ xoá sạch phần
 * lương gắn với nhóm không được cấu hình.
 *
 * @throws {PerformanceReviewInvalidError} Thiếu điểm cho một tiêu chí, hoặc có
 *         điểm cho tiêu chí không thuộc phiên bản này.
 */
export function computeReviewTotals(criteria: readonly Criterion[], scores: readonly CriterionScore[]): ReviewTotals {
    const scoreById = new Map(scores.map(entry => [entry.criterionId, entry.score]));

    const known = new Set(criteria.map(criterion => criterion.id));
    for (const entry of scores) {
        if (!known.has(entry.criterionId)) {
            throw new PerformanceReviewInvalidError(`Score refers to unknown criterion: ${entry.criterionId}`);
        }
    }

    const missing = criteria.filter(criterion => !scoreById.has(criterion.id));
    if (missing.length > 0) {
        throw new PerformanceReviewInvalidError(
            `Missing scores for criteria: ${missing.map(criterion => criterion.code).join(", ")}`,
        );
    }

    return {
        kpiScore:         weightedAverage(criteria, scoreById, "kpi"),
        goalScore:        weightedAverage(criteria, scoreById, "goal"),
        performanceScore: weightedAverage(criteria, scoreById, "performance"),
    };
}

const FULL_SCORE = 100;

function weightedAverage(criteria: readonly Criterion[], scoreById: Map<string, number>, kind: string): number {
    const ofKind = criteria.filter(criterion => criterion.kind.value === kind);
    if (ofKind.length === 0) return FULL_SCORE;

    let weighted = 0;
    let weights  = 0;
    for (const criterion of ofKind) {
        weighted += (scoreById.get(criterion.id) ?? 0) * criterion.weight;
        weights  += criterion.weight;
    }

    return weights === 0 ? FULL_SCORE : Math.round((weighted / weights) * 100) / 100;
}
