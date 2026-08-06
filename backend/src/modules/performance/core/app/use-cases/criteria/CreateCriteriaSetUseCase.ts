import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import CriteriaSetRepo from "@modules/performance/core/app/ports/CriteriaSetRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";
import createUuidV7 from "@shared/core/domain/UuidV7";

export interface CreateCriteriaSetInput {
    name:         string;
    description?: string | undefined;
    actorUserId:  string;
}

export interface CreateCriteriaSetOutput {
    criteriaSetId: string;
}

/**
 * Tạo bộ tiêu chí (chưa có phiên bản nào). Tiêu chí thật được thêm bằng
 * `PublishCriteriaVersionUseCase` — tách hai bước để mọi tập tiêu chí đưa vào sử
 * dụng đều là một phiên bản có số, có người phát hành và có mốc thời gian.
 *
 * @throws {AccessDeniedError}       Actor không có quyền `performance:manage`.
 * @throws {CriteriaSetInvalidError} Tên rỗng hoặc quá dài.
 */
export default class CreateCriteriaSetUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _criteriaSetRepo: CriteriaSetRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: CreateCriteriaSetInput): Promise<CreateCriteriaSetOutput> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const criteriaSet = CriteriaSet.create({
            id:          createUuidV7(),
            name:        input.name,
            description: input.description ?? null,
            createdBy:   input.actorUserId,
        });

        await this._criteriaSetRepo.save(criteriaSet);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_criteria_set",
            action:      "create",
            resourceId:  criteriaSet.id,
            changes:     { name: criteriaSet.name },
        });

        return { criteriaSetId: criteriaSet.id };
    }
}
