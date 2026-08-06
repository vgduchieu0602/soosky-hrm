import AttendanceCorrectionRequestRepo from "@modules/attendance/core/app/ports/AttendanceCorrectionRequestRepo";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import AttendanceCorrectionRequest, { CorrectionStatus } from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";

export interface ListAttendanceCorrectionsInput {
    /** Bỏ trống = toàn bộ trong phạm vi actor (hàng chờ duyệt của quản lý/HR). */
    employeeId?: string | undefined;
    status?: CorrectionStatus | undefined;
    actorUserId: string;
}

/**
 * Liệt kê yêu cầu chỉnh công trong phạm vi actor: Employee thấy yêu cầu của
 * mình, Manager thấy của mình + cấp dưới (đây chính là hàng chờ duyệt), HR thấy
 * tất cả.
 *
 * Lọc `employeeId` là thu hẹp THÊM; ngoài phạm vi thì bị từ chối chứ không im
 * lặng trả rỗng.
 *
 * @throws {AccessDeniedError} Không có quyền, hoặc nhân viên ngoài phạm vi.
 */
export default class ListAttendanceCorrectionsUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _requestRepo: AttendanceCorrectionRequestRepo,
    ) {}

    public async execute(input: ListAttendanceCorrectionsInput): Promise<AttendanceCorrectionRequest[]> {
        if (input.employeeId != undefined) {
            await this._accessScope.assertCanReadCorrection(input.actorUserId, input.employeeId);
            return this._requestRepo.list({
                employeeIds: [input.employeeId],
                ...(input.status != undefined ? { status: input.status } : {}),
            });
        }

        const visibleIds = await this._accessScope.visibleCorrectionEmployeeIds(input.actorUserId);
        if (visibleIds != undefined && visibleIds.length === 0) return [];

        return this._requestRepo.list({
            ...(visibleIds == undefined ? {} : { employeeIds: visibleIds }),
            ...(input.status != undefined ? { status: input.status } : {}),
        });
    }
}
