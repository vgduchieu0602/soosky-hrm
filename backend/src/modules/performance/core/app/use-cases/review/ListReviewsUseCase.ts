import PerformanceReviewRepo from "@modules/performance/core/app/ports/PerformanceReviewRepo";
import PerformanceAccessScope from "@modules/performance/core/app/services/PerformanceAccessScope";
import PerformanceReview, { ReviewStatus } from "@modules/performance/core/domain/entities/PerformanceReview";

export interface ListReviewsInput {
    cycleId?: string | undefined;
    employeeId?: string | undefined;
    status?: ReviewStatus | undefined;
    /** true = chỉ phiếu mà actor là người chấm (hàng việc của quản lý). */
    assignedToMe?: boolean | undefined;
    actorUserId: string;
}

/**
 * Liệt kê phiếu đánh giá trong PHẠM VI actor được xem: HR tất cả, Manager mình +
 * cấp dưới, Employee chỉ mình.
 *
 * Lọc `employeeId` là thu hẹp THÊM; ngoài phạm vi thì bị từ chối chứ không im
 * lặng trả rỗng — client cần phân biệt "không có quyền" với "không có dữ liệu".
 *
 * @throws {AccessDeniedError} Không có quyền đọc, hoặc nhân viên ngoài phạm vi.
 */
export default class ListReviewsUseCase {
    public constructor(
        private readonly _accessScope: PerformanceAccessScope,
        private readonly _reviewRepo: PerformanceReviewRepo,
    ) {}

    public async execute(input: ListReviewsInput): Promise<PerformanceReview[]> {
        const common = {
            ...(input.cycleId != undefined ? { cycleId: input.cycleId } : {}),
            ...(input.status != undefined ? { status: input.status } : {}),
            ...(input.assignedToMe === true ? { reviewerUserId: input.actorUserId } : {}),
        };

        if (input.employeeId != undefined) {
            await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);
            return this._reviewRepo.list({ ...common, employeeIds: [input.employeeId] });
        }

        const visibleIds = await this._accessScope.visibleEmployeeIds(input.actorUserId);
        if (visibleIds != undefined && visibleIds.length === 0) return [];

        return this._reviewRepo.list({
            ...common,
            ...(visibleIds == undefined ? {} : { employeeIds: visibleIds }),
        });
    }
}
