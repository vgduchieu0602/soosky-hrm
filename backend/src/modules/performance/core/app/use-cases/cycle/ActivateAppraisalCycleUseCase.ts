import AppraisalCycleNotFoundError from "@modules/performance/core/app/errors/AppraisalCycleNotFoundError";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import EmployeeDirectory from "@modules/performance/core/app/ports/EmployeeDirectory";
import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import PerformanceReview from "@modules/performance/core/domain/entities/PerformanceReview";
import createUuidV7 from "@shared/core/domain/UuidV7";

export interface ActivateAppraisalCycleInput {
    cycleId: string;
    /**
     * Người chấm mặc định khi nhân viên KHÔNG có quản lý trực tiếp (hoặc quản lý
     * chưa có tài khoản). Bỏ trống → chính actor (HR) tự chấm những người đó.
     */
    fallbackReviewerUserId?: string | undefined;
    actorUserId: string;
}

export interface ActivateAppraisalCycleOutput {
    assigned: number;
    /** Nhân viên được phân công cho người chấm dự phòng vì thiếu quản lý. */
    withoutManager: string[];
}

/**
 * Mở chu kỳ và PHÂN CÔNG người chấm cho TOÀN BỘ nhân viên đang làm việc.
 *
 * Phân công tự động theo chuỗi quản lý trực tiếp, vì đó là quy tắc đúng trong
 * ~100% trường hợp; HR đổi lại từng phiếu bằng `AssignReviewerUseCase`.
 *
 * Tạo phiếu cho MỌI nhân viên active ngay lúc mở chu kỳ (chứ không đợi người
 * chấm tự tạo) để yêu cầu "mọi nhân viên trong kỳ đều có điểm" kiểm được bằng
 * dữ liệu: thiếu điểm nghĩa là còn phiếu chưa khoá, không phải phiếu chưa từng
 * tồn tại.
 *
 * Idempotent: gọi lại chỉ thêm phiếu cho người còn thiếu (nhân viên mới vào).
 *
 * @throws {AccessDeniedError}            Actor không có quyền `performance:manage`.
 * @throws {AppraisalCycleNotFoundError}  Chu kỳ không tồn tại.
 * @throws {AppraisalCycleInvalidError}   Chu kỳ không còn ở trạng thái `draft`.
 */
export default class ActivateAppraisalCycleUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _cycleRepo: AppraisalCycleRepo,
        private readonly _reviewRepo: PerformanceReviewRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: ActivateAppraisalCycleInput): Promise<ActivateAppraisalCycleOutput> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const cycle = await this._cycleRepo.getById(input.cycleId);
        if (cycle == undefined) throw new AppraisalCycleNotFoundError();

        cycle.activate();

        const employeeIds    = await this._employees.listActiveEmployeeIds();
        const fallback       = input.fallbackReviewerUserId ?? input.actorUserId;
        const withoutManager: string[] = [];
        let assigned = 0;

        for (const employeeId of employeeIds) {
            if (await this._reviewRepo.findOne(cycle.id, employeeId) != undefined) continue;

            const managerAccountId = await this._employees.managerAccountIdOf(employeeId);
            if (managerAccountId == undefined) withoutManager.push(employeeId);

            await this._reviewRepo.save(PerformanceReview.create({
                id:              createUuidV7(),
                cycleId:         cycle.id,
                employeeId,
                reviewerUserId:  managerAccountId ?? fallback,
                criteriaSetId:   cycle.criteriaSetId,
                criteriaVersion: cycle.criteriaVersion,
            }));
            assigned += 1;
        }

        await this._cycleRepo.save(cycle);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_cycle",
            action:      "activate",
            resourceId:  cycle.id,
            changes:     { assigned, withoutManager: withoutManager.length, totalActiveEmployees: employeeIds.length },
        });

        return { assigned, withoutManager };
    }
}
