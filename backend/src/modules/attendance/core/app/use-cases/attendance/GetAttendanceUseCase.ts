import AttendanceNotFoundError from "@modules/attendance/core/app/errors/AttendanceNotFoundError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export interface GetAttendanceInput {
    attendanceId: string;
}

/**
 * Lấy chi tiết một bản ghi chấm công.
 *
 * @throws {AttendanceNotFoundError} Không tìm thấy bản ghi.
 */
export default class GetAttendanceUseCase {
    public constructor(
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: GetAttendanceInput): Promise<Attendance> {
        const attendance = await this._attendanceRepo.getById(input.attendanceId);
        if (attendance == undefined) throw new AttendanceNotFoundError();
        return attendance;
    }
}
