import AppraisalCycleNotFoundError from "@modules/performance/core/app/errors/AppraisalCycleNotFoundError";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import EmployeeDirectory from "@modules/performance/core/app/ports/EmployeeDirectory";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import { ReviewStatus } from "@modules/performance/core/domain/entities/PerformanceReview";

export interface GetCycleReadinessInput {
    cycleId:     string;
    actorUserId: string;
}

export interface GetCycleReadinessOutput {
    cycleId:              string;
    payrollPeriodId:      string;
    cycleStatus:          string;
    totalActiveEmployees: number;
    lockedCount:          number;
    /** Nhân viên đang làm việc mà điểm CHƯA khoá — chặn đóng chu kỳ. */
    pendingEmployeeIds:   string[];
    countByStatus:        Record<ReviewStatus, number>;
    ready:                boolean;
}

/**
 * Bảng theo dõi tiến độ một chu kỳ: ai đã khoá điểm, ai còn dở, dở ở bước nào.
 *
 * Đây là câu trả lời cho "mọi nhân viên trong kỳ có điểm hợp lệ chưa" — HR xem
 * trước khi đóng chu kỳ, và `CloseAppraisalCycleUseCase` dùng đúng phép tính này
 * để chặn, nên số liệu trên màn hình và điều kiện chặn không bao giờ lệch nhau.
 *
 * @throws {AccessDeniedError}           Actor không có quyền `performance:manage`.
 * @throws {AppraisalCycleNotFoundError} Chu kỳ không tồn tại.
 */
export default class GetCycleReadinessUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _cycleRepo: AppraisalCycleRepo,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _employees: EmployeeDirectory,
    ) {}

    public async execute(input: GetCycleReadinessInput): Promise<GetCycleReadinessOutput> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const cycle = await this._cycleRepo.getById(input.cycleId);
        if (cycle == undefined) throw new AppraisalCycleNotFoundError();

        const reviews     = await this._reviewRepo.listByCycle(cycle.id);
        const employeeIds = await this._employees.listActiveEmployeeIds();

        const lockedEmployeeIds = new Set(reviews.filter(review => review.isLocked).map(review => review.employeeId));
        const pendingEmployeeIds = employeeIds.filter(employeeId => !lockedEmployeeIds.has(employeeId));

        const countByStatus = {
            draft: 0, submitted: 0, approved: 0, acknowledged: 0, appealed: 0, locked: 0,
        } as Record<ReviewStatus, number>;
        for (const review of reviews) countByStatus[review.status] += 1;

        return {
            cycleId:              cycle.id,
            payrollPeriodId:      cycle.payrollPeriodId,
            cycleStatus:          cycle.status,
            totalActiveEmployees: employeeIds.length,
            lockedCount:          lockedEmployeeIds.size,
            pendingEmployeeIds,
            countByStatus,
            ready:                pendingEmployeeIds.length === 0,
        };
    }
}
