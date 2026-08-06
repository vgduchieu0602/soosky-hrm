import AppraisalCycleNotFoundError from "@modules/performance/core/app/errors/AppraisalCycleNotFoundError";
import CycleNotReadyError from "@modules/performance/core/app/errors/CycleNotReadyError";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import EmployeeDirectory from "@modules/performance/core/app/ports/EmployeeDirectory";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";

export interface CloseAppraisalCycleInput {
    cycleId:     string;
    actorUserId: string;
}

/**
 * Đóng chu kỳ — chỉ khi MỌI nhân viên đang làm việc đã có điểm ĐÃ KHOÁ.
 *
 * Chặn ở đây thay vì để bảng lương tự xoay xở: chạy lương trên chu kỳ dở dang
 * nghĩa là một số người ăn điểm mặc định, một số ăn điểm thật — sai lệch âm thầm
 * và rất khó truy lại.
 *
 * @throws {AccessDeniedError}           Actor không có quyền `performance:manage`.
 * @throws {AppraisalCycleNotFoundError} Chu kỳ không tồn tại.
 * @throws {CycleNotReadyError}          Còn nhân viên chưa khoá điểm.
 * @throws {AppraisalCycleInvalidError}  Chu kỳ chưa mở hoặc đã đóng.
 */
export default class CloseAppraisalCycleUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _cycleRepo: AppraisalCycleRepo,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: CloseAppraisalCycleInput): Promise<void> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const cycle = await this._cycleRepo.getById(input.cycleId);
        if (cycle == undefined) throw new AppraisalCycleNotFoundError();

        const reviews     = await this._reviewRepo.listByCycle(cycle.id);
        const employeeIds = await this._employees.listActiveEmployeeIds();

        const locked  = new Set(reviews.filter(review => review.isLocked).map(review => review.employeeId));
        const pending = employeeIds.filter(employeeId => !locked.has(employeeId));
        if (pending.length > 0) throw new CycleNotReadyError(pending.length);

        cycle.close();
        await this._cycleRepo.save(cycle);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_cycle",
            action:      "close",
            resourceId:  cycle.id,
            changes:     { payrollPeriodId: cycle.payrollPeriodId, lockedReviews: locked.size },
        });
    }
}
