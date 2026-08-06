import CriteriaSetNotFoundError from "@modules/performance/core/app/errors/CriteriaSetNotFoundError";
import AuditTrail from "@modules/performance/core/app/ports/AuditTrail";
import CriteriaSetRepo from "@modules/performance/core/app/ports/CriteriaSetRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import CriterionKind from "@modules/performance/core/domain/value-objects/CriterionKind";
import createUuidV7 from "@shared/core/domain/UuidV7";

export interface PublishCriteriaVersionInput {
    criteriaSetId: string;
    criteria: {
        code:   string;
        name:   string;
        kind:   string;
        weight: number;
    }[];
    actorUserId: string;
}

export interface PublishCriteriaVersionOutput {
    criteriaSetId: string;
    version:       number;
}

/**
 * Phát hành một PHIÊN BẢN MỚI của bộ tiêu chí.
 *
 * Sửa tiêu chí = phát hành phiên bản mới, KHÔNG sửa phiên bản cũ. Phiếu đánh
 * giá đã chấm giữ nguyên số phiên bản nó dùng, nên điểm cũ luôn đọc được theo
 * đúng bộ tiêu chí lúc đó — yêu cầu "không tự thay đổi lịch sử khi tiêu chí bị
 * sửa" được bảo đảm bằng cấu trúc dữ liệu, không phải bằng quy trình.
 *
 * @throws {AccessDeniedError}        Actor không có quyền `performance:manage`.
 * @throws {CriteriaSetNotFoundError} Bộ tiêu chí không tồn tại.
 * @throws {CriteriaSetInvalidError}  Danh sách rỗng, mã trùng, hoặc tổng trọng số một nhóm khác 100.
 */
export default class PublishCriteriaVersionUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _criteriaSetRepo: CriteriaSetRepo,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: PublishCriteriaVersionInput): Promise<PublishCriteriaVersionOutput> {
        await this._accessScope.assertCanManage(input.actorUserId);

        const criteriaSet = await this._criteriaSetRepo.getById(input.criteriaSetId);
        if (criteriaSet == undefined) throw new CriteriaSetNotFoundError();

        const version = criteriaSet.publishVersion({
            criteria: input.criteria.map(criterion => ({
                code:   criterion.code,
                name:   criterion.name,
                kind:   CriterionKind.create(criterion.kind),
                weight: criterion.weight,
            })),
            publishedBy:    input.actorUserId,
            newCriterionId: createUuidV7,
        });

        await this._criteriaSetRepo.save(criteriaSet);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "performance_criteria_version",
            action:      "publish",
            resourceId:  criteriaSet.id,
            changes:     {
                version:       version.version,
                criteriaCount: version.criteria.length,
                criteria:      version.criteria.map(c => ({ code: c.code, kind: c.kind.value, weight: c.weight })),
            },
        });

        return { criteriaSetId: criteriaSet.id, version: version.version };
    }
}
