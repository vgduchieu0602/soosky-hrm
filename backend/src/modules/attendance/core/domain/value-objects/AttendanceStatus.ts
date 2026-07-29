import AttendanceStatusInvalidError from "@modules/attendance/core/domain/errors/AttendanceStatusInvalidError";

/**
 * Trạng thái một bản ghi chấm công trong ngày: `present` (đúng giờ), `late`
 * (đi trễ), `early_leave` (về sớm), `absent` (vắng), `incomplete` (mới
 * check-in, chưa check-out), `leave_paid`/`leave_unpaid` (nghỉ phép có/không
 * lương) hoặc `holiday` (ngày lễ).
 */
export default class AttendanceStatus {
    static readonly PRESENT     = new AttendanceStatus("present");
    static readonly LATE        = new AttendanceStatus("late");
    static readonly EARLY_LEAVE = new AttendanceStatus("early_leave");
    static readonly ABSENT      = new AttendanceStatus("absent");
    static readonly INCOMPLETE  = new AttendanceStatus("incomplete");
    static readonly LEAVE_PAID  = new AttendanceStatus("leave_paid");
    static readonly LEAVE_UNPAID = new AttendanceStatus("leave_unpaid");
    static readonly HOLIDAY     = new AttendanceStatus("holiday");

    private static readonly ALL = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.LATE,
        AttendanceStatus.EARLY_LEAVE,
        AttendanceStatus.ABSENT,
        AttendanceStatus.INCOMPLETE,
        AttendanceStatus.LEAVE_PAID,
        AttendanceStatus.LEAVE_UNPAID,
        AttendanceStatus.HOLIDAY,
    ];

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): AttendanceStatus {
        const found = AttendanceStatus.ALL.find(s => s.value === raw);
        if (found == undefined) {
            throw new AttendanceStatusInvalidError(`Invalid attendance status: ${raw}`);
        }
        return found;
    }

    equals(other: AttendanceStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
