import AttendanceDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/AttendanceDocument";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import AttendanceStatus from "@modules/attendance/core/domain/value-objects/AttendanceStatus";

const AttendanceMapper = {
    toDocument(attendance: Attendance): AttendanceDocument {
        return {
            _id:            attendance.id,
            employeeId:     attendance.employeeId,
            date:           attendance.date,
            shiftId:        attendance.shiftId,
            checkIn:        attendance.checkIn,
            checkOut:       attendance.checkOut,
            status:         attendance.status.value,
            workHours:      attendance.workHours,
            lateMinutes:    attendance.lateMinutes,
            earlyMinutes:   attendance.earlyMinutes,
            session:        attendance.session.value,
            congWeight:     attendance.congWeight,
            source:         attendance.source,
            note:           attendance.note,
            leaveRequestId: attendance.leaveRequestId,
            createdAt:      attendance.createdAt,
        };
    },

    toDomain(document: AttendanceDocument): Attendance {
        return Attendance.rehydrate({
            id:             document._id,
            employeeId:     document.employeeId,
            date:           document.date,
            shiftId:        document.shiftId,
            checkIn:        document.checkIn,
            checkOut:       document.checkOut,
            status:         AttendanceStatus.create(document.status),
            workHours:      document.workHours,
            lateMinutes:    document.lateMinutes,
            earlyMinutes:   document.earlyMinutes,
            session:        AttendanceSession.create(document.session),
            congWeight:     document.congWeight,
            source:         document.source,
            note:           document.note,
            leaveRequestId: document.leaveRequestId,
            createdAt:      document.createdAt,
        });
    },
};

export default AttendanceMapper;
