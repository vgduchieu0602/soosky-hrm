import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import PermissionChecker from "@modules/performance/core/app/ports/PermissionChecker";
import { PERFORMANCE_READ_PERMISSION_KEY } from "@modules/performance/core/app/services/PerformanceAccessScope";
import AppraisalCycle from "@modules/performance/core/domain/entities/AppraisalCycle";

export interface ListAppraisalCyclesInput {
    actorUserId: string;
}

/**
 * Liệt kê chu kỳ đánh giá. Chỉ cần quyền đọc ở bất kỳ phạm vi: nhân viên cần
 * biết đang có chu kỳ nào để xem phiếu của mình; danh sách không chứa điểm.
 *
 * @throws {AccessDeniedError} Actor không có quyền đọc dữ liệu đánh giá.
 */
export default class ListAppraisalCyclesUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _cycleRepo: AppraisalCycleRepo,
    ) {}

    public async execute(input: ListAppraisalCyclesInput): Promise<AppraisalCycle[]> {
        await this._permissions.resolveScope(input.actorUserId, PERFORMANCE_READ_PERMISSION_KEY);
        return this._cycleRepo.listAll();
    }
}
