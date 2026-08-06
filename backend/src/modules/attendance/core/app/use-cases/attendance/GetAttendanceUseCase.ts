import AttendanceNotFoundError from "@modules/attendance/core/app/errors/AttendanceNotFoundError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export interface GetAttendanceInput {
    attendanceId: string;
    actorUserId:  string;
}

/**
 * Lấy chi tiết một bản ghi chấm công, trong phạm vi actor được xem.
 *
 * @throws {AttendanceNotFoundError} Không tìm thấy bản ghi.
 * @throws {AccessDeniedError}       Bản ghi thuộc nhân viên ngoài phạm vi của actor.
 */
export default class GetAttendanceUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: GetAttendanceInput): Promise<Attendance> {
        const attendance = await this._attendanceRepo.getById(input.attendanceId);
        if (attendance == undefined) throw new AttendanceNotFoundError();

        // Kiểm quyền SAU khi đọc: phải biết bản ghi của ai mới xét được phạm vi.
        // Không tồn tại thì 404 chứ không 403 — không tiết lộ gì thêm.
        await this._accessScope.assertCanRead(input.actorUserId, attendance.employeeId);
        return attendance;
    }
}
