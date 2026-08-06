import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export default interface AttendanceRepo {
    getById(id: string): Promise<Attendance | undefined>;
    getBySlot(employeeId: string, date: Date, shiftId: string): Promise<Attendance | undefined>;
    listByEmployeeAndRange(employeeId: string, start: Date, end: Date): Promise<Attendance[]>;
    /**
     * Bảng công của NHIỀU nhân viên trong một khoảng — dùng cho lưới chấm công
     * của HR. `employeeIds` bỏ trống = mọi nhân viên (chỉ gọi khi actor có phạm
     * vi `all`, xem `ListVisibleAttendanceUseCase`).
     */
    listByRange(start: Date, end: Date, employeeIds?: string[] | undefined): Promise<Attendance[]>;
    /** Có bản ghi nghỉ phép cả ngày (source "leave", session "full_day") tại ngày này hay không. */
    findFullDayLeave(employeeId: string, date: Date): Promise<Attendance | undefined>;
    save(attendance: Attendance): Promise<void>;
    deleteById(id: string): Promise<void>;
    deleteByLeaveRequestId(leaveRequestId: string): Promise<void>;
}
