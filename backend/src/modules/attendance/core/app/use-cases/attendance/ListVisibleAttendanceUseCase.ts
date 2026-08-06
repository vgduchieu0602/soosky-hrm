import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export interface ListVisibleAttendanceInput {
    start:       Date;
    end:         Date;
    actorUserId: string;
}

/**
 * Bảng công của MỌI nhân viên trong phạm vi của actor, trong một khoảng ngày —
 * nguồn dữ liệu cho lưới chấm công của HR/Manager.
 *
 * Khác `ListAttendanceUseCase` (một nhân viên, mặc định là chính actor): ở đây
 * phạm vi quyết định tập nhân viên — `all` là tất cả, `team` là chính mình +
 * cấp dưới, `self` là chính mình. Không có endpoint này thì lưới HR phải gọi
 * N+1 lần theo từng nhân viên.
 *
 * @throws {AccessDeniedError} Actor không có quyền xem bảng công.
 */
export default class ListVisibleAttendanceUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: ListVisibleAttendanceInput): Promise<Attendance[]> {
        const employeeIds = await this._accessScope.visibleAttendanceEmployeeIds(input.actorUserId);
        // `undefined` = phạm vi `all`; mảng rỗng = không thấy ai -> trả rỗng thay
        // vì để repo hiểu thành "không giới hạn".
        if (employeeIds != undefined && employeeIds.length === 0) return [];

        return this._attendanceRepo.listByRange(input.start, input.end, employeeIds);
    }
}
