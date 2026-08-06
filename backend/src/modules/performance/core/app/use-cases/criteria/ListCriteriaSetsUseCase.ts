import CriteriaSetRepo from "@modules/performance/core/app/ports/CriteriaSetRepo";
import PermissionChecker from "@modules/performance/core/app/ports/PermissionChecker";
import PerformanceAccessScope, { PERFORMANCE_READ_PERMISSION_KEY } from "@modules/performance/core/app/services/PerformanceAccessScope";
import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";

export interface ListCriteriaSetsInput {
    actorUserId: string;
}

/**
 * Liệt kê bộ tiêu chí kèm toàn bộ phiên bản.
 *
 * Chỉ cần quyền ĐỌC ở bất kỳ phạm vi nào: bộ tiêu chí là thông tin chung của
 * công ty (nhân viên có quyền biết mình được đánh giá theo thang nào), không
 * chứa dữ liệu của cá nhân nào.
 *
 * @throws {AccessDeniedError} Actor không có quyền đọc dữ liệu đánh giá.
 */
export default class ListCriteriaSetsUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _criteriaSetRepo: CriteriaSetRepo,
        private readonly _accessScope: PerformanceAccessScope,
    ) {}

    public async execute(input: ListCriteriaSetsInput): Promise<CriteriaSet[]> {
        void this._accessScope;
        await this._permissions.resolveScope(input.actorUserId, PERFORMANCE_READ_PERMISSION_KEY);
        return this._criteriaSetRepo.listAll();
    }
}
