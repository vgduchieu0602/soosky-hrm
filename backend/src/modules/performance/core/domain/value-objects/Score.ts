import PerformanceReviewInvalidError from "@modules/performance/core/domain/errors/PerformanceReviewInvalidError";

const MIN = 0;
const MAX = 100;

/**
 * Điểm trên thang 0..100. Cùng thang với `performanceRatio`/`goalRatio` mà
 * `computePayroll` nhận (nó chia cho 100), nên không có bước đổi thang nào ở
 * giữa — chỗ dễ sai nhất khi nối đánh giá vào lương.
 */
export default class Score {
    private constructor(
        public readonly value: number,
    ) {}

    static create(raw: number): Score {
        if (!Number.isFinite(raw) || raw < MIN || raw > MAX) {
            throw new PerformanceReviewInvalidError(`Score must be a number between ${MIN} and ${MAX}, got: ${raw}`);
        }
        return new Score(Math.round(raw * 100) / 100);
    }
}
