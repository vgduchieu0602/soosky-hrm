import { MongoAppraisalCycleRepo, MongoPerformanceReviewRepo } from "@modules/performance/adapters/driven/persistence/mongodb";
import { Db as MongoDb } from "mongodb";

/** Tiến độ chu kỳ đánh giá gắn với một kỳ lương. */
export interface EvaluationProgress {
    cycleId:            string;
    cycleStatus:        string;
    lockedCount:        number;
    pendingEmployeeIds: string[];
}

/**
 * Bề mặt tra cứu tiến độ đánh giá mà module khác (Payroll) được phép tiêu thụ.
 * KHÔNG có cách nào đọc điểm qua đây: điểm đi sang Payroll bằng bản chụp lúc
 * khoá, không phải bằng truy vấn ngược.
 */
export interface PerformanceEvaluationDirectory {
    progressForPayrollPeriod(payrollPeriodId: string, activeEmployeeIds: readonly string[]): Promise<EvaluationProgress | undefined>;
}

/**
 * Lắp `PerformanceEvaluationDirectory` trên nền MongoDB.
 *
 * Nhận `activeEmployeeIds` từ caller thay vì tự đọc danh bạ nhân viên: Payroll
 * đã có sẵn danh sách đó khi kiểm tra readiness, và nhờ vậy Performance không
 * cần phụ thuộc thêm module Employee chỉ để phục vụ một câu truy vấn.
 */
export function createPerformanceEvaluationDirectory(mongoDb: MongoDb): PerformanceEvaluationDirectory {
    const cycleRepo  = new MongoAppraisalCycleRepo(mongoDb);
    const reviewRepo = new MongoPerformanceReviewRepo(mongoDb);

    return {
        progressForPayrollPeriod: async (payrollPeriodId, activeEmployeeIds) => {
            const cycle = await cycleRepo.findByPayrollPeriodId(payrollPeriodId);
            if (cycle == undefined) return undefined;

            const reviews = await reviewRepo.listByCycle(cycle.id);
            const locked  = new Set(reviews.filter(review => review.isLocked).map(review => review.employeeId));

            return {
                cycleId:            cycle.id,
                cycleStatus:        cycle.status,
                lockedCount:        locked.size,
                pendingEmployeeIds: activeEmployeeIds.filter(employeeId => !locked.has(employeeId)),
            };
        },
    };
}

/**
 * Bề mặt đọc tiến độ đánh giá cho READ MODEL (module Dashboard).
 *
 * KHÔNG trả điểm ở bất kỳ hàm nào — chỉ đếm và trạng thái. Xem điểm của người
 * khác cần một chính sách quyền riêng, chưa được phê duyệt, nên bảng điều khiển
 * không có xếp hạng.
 */
export interface PerformanceReportDirectory {
    /** Chu kỳ đang mở gần nhất + số phiếu đã khoá / còn lại. */
    activeCycleProgress(): Promise<{ cycleId: string; cycleStatus: string; lockedCount: number; pendingCount: number } | undefined>;
    /** Số phiếu được phân công cho reviewer mà CHƯA khoá. */
    countReviewsToScore(reviewerUserId: string): Promise<number>;
    /** Trạng thái phiếu gần nhất của một nhân viên. */
    latestReviewStatusOf(employeeId: string): Promise<string | undefined>;
}

export function createPerformanceReportDirectory(mongoDb: MongoDb): PerformanceReportDirectory {
    const cycleRepo  = new MongoAppraisalCycleRepo(mongoDb);
    const reviewRepo = new MongoPerformanceReviewRepo(mongoDb);

    return {
        activeCycleProgress: async () => {
            const cycles = await cycleRepo.listAll();
            const cycle = cycles.find(row => row.status === "active") ?? cycles[0];
            if (cycle == undefined) return undefined;

            const reviews = await reviewRepo.listByCycle(cycle.id);
            const locked = reviews.filter(review => review.isLocked).length;

            return {
                cycleId:      cycle.id,
                cycleStatus:  cycle.status,
                lockedCount:  locked,
                pendingCount: reviews.length - locked,
            };
        },

        countReviewsToScore: async (reviewerUserId: string) => {
            const reviews = await reviewRepo.list({ reviewerUserId });
            return reviews.filter(review => !review.isLocked).length;
        },

        latestReviewStatusOf: async (employeeId: string) => {
            const reviews = await reviewRepo.list({ employeeIds: [employeeId] });
            return reviews[0]?.status;
        },
    };
}
