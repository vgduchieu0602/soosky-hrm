import AppraisalCycleConflictError from "@modules/performance/core/app/errors/AppraisalCycleConflictError";
import CriteriaSetNotFoundError from "@modules/performance/core/app/errors/CriteriaSetNotFoundError";
import CriteriaVersionNotFoundError from "@modules/performance/core/app/errors/CriteriaVersionNotFoundError";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import CriteriaSetRepo from "@modules/performance/core/app/ports/CriteriaSetRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import AppraisalCycle from "@modules/performance/core/domain/entities/AppraisalCycle";
import createUuidV7 from "@shared/core/domain/UuidV7";

export interface CreateAppraisalCycleInput {
    name:            string;
    payrollPeriodId: string;
    criteriaSetId:   string;
    /** Bỏ trống → chốt phiên bản MỚI NHẤT tại thời điểm tạo chu kỳ. */
    criteriaVersion?: number | undefined;
    actorUserId:     string;
}

export interface CreateAppraisalCycleOutput {
    cycleId:         string;
    criteriaVersion: number;
}

/**
 * Tạo chu kỳ đánh giá cho một kỳ lương, chốt luôn phiên bản bộ tiêu chí.
 *
 * Một kỳ lương chỉ được có MỘT chu kỳ: hai chu kỳ cùng kỳ lương thì bản chụp
 * điểm của chu kỳ sau sẽ ghi đè chu kỳ trước, và không ai biết lương đang dựa
 * trên chu kỳ nào.
 *
 * @throws {AccessDeniedError}             Actor không có quyền `performance:manage`.
 * @throws {CriteriaSetNotFoundError}      Bộ tiêu chí không tồn tại.
 * @throws {CriteriaVersionNotFoundError}  Phiên bản không tồn tại (hoặc bộ chưa có phiên bản nào).
 * @throws {AppraisalCycleConflictError}   Kỳ lương này đã có chu kỳ đánh giá.
 */
export default class CreateAppraisalCycleUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _cycleRepo: AppraisalCycleRepo,
        private readonly _criteriaSetRepo: CriteriaSetRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: CreateAppraisalCycleInput): Promise<CreateAppraisalCycleOutput> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const duplicate = await this._cycleRepo.findByPayrollPeriodId(input.payrollPeriodId);
        if (duplicate != undefined) throw new AppraisalCycleConflictError(input.payrollPeriodId);

        const criteriaSet = await this._criteriaSetRepo.getById(input.criteriaSetId);
        if (criteriaSet == undefined) throw new CriteriaSetNotFoundError();

        const version = input.criteriaVersion == undefined
            ? criteriaSet.latestVersion?.version
            : criteriaSet.getVersion(input.criteriaVersion)?.version;
        if (version == undefined) throw new CriteriaVersionNotFoundError(input.criteriaVersion ?? 0);

        const cycle = AppraisalCycle.create({
            id:              createUuidV7(),
            name:            input.name,
            payrollPeriodId: input.payrollPeriodId,
            criteriaSetId:   input.criteriaSetId,
            criteriaVersion: version,
            createdBy:       input.actorUserId,
        });

        await this._cycleRepo.save(cycle);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_cycle",
            action:      "create",
            resourceId:  cycle.id,
            changes:     {
                name: cycle.name, payrollPeriodId: cycle.payrollPeriodId,
                criteriaSetId: cycle.criteriaSetId, criteriaVersion: cycle.criteriaVersion,
            },
        });

        return { cycleId: cycle.id, criteriaVersion: version };
    }
}
