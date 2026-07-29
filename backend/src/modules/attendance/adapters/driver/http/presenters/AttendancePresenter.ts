import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export interface AttendanceDTO {
    id:             string;
    employeeId:     string;
    date:           string;
    shiftId:        string;
    checkIn:        string | null;
    checkOut:       string | null;
    status:         string;
    workHours:      number | null;
    lateMinutes:    number;
    earlyMinutes:   number;
    session:        string;
    congWeight:     number;
    source:         string;
    note:           string | null;
    leaveRequestId: string | null;
}

const AttendancePresenter = {
    toDTO(attendance: Attendance): AttendanceDTO {
        return {
            id:             attendance.id,
            employeeId:     attendance.employeeId,
            date:           attendance.date.toISOString(),
            shiftId:        attendance.shiftId,
            checkIn:        attendance.checkIn?.toISOString() ?? null,
            checkOut:       attendance.checkOut?.toISOString() ?? null,
            status:         attendance.status.value,
            workHours:      attendance.workHours,
            lateMinutes:    attendance.lateMinutes,
            earlyMinutes:   attendance.earlyMinutes,
            session:        attendance.session.value,
            congWeight:     attendance.congWeight,
            source:         attendance.source,
            note:           attendance.note,
            leaveRequestId: attendance.leaveRequestId,
        };
    },
};

export default AttendancePresenter;
