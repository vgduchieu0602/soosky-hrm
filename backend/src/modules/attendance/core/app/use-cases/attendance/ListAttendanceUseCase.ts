import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export interface ListAttendanceInput {
    employeeId: string;
    start:      Date;
    end:        Date;
}

/** Liệt kê bản ghi chấm công của một nhân viên trong một khoảng ngày. */
export default class ListAttendanceUseCase {
    public constructor(
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: ListAttendanceInput): Promise<Attendance[]> {
        return this._attendanceRepo.listByEmployeeAndRange(input.employeeId, input.start, input.end);
    }
}
