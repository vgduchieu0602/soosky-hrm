import AttendanceSessionInvalidError from "@modules/attendance/core/domain/errors/AttendanceSessionInvalidError";

/**
 * Buổi làm việc trong ngày mà một ca (hoặc bản ghi chấm công) chiếm giữ:
 * `morning` (sáng), `afternoon` (chiều) hay `full_day` (cả ngày).
 */
export default class AttendanceSession {
    static readonly MORNING   = new AttendanceSession("morning");
    static readonly AFTERNOON = new AttendanceSession("afternoon");
    static readonly FULL_DAY  = new AttendanceSession("full_day");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): AttendanceSession {
        const found = [AttendanceSession.MORNING, AttendanceSession.AFTERNOON, AttendanceSession.FULL_DAY]
            .find(s => s.value === raw);
        if (found == undefined) {
            throw new AttendanceSessionInvalidError(`Invalid attendance session: ${raw}`);
        }
        return found;
    }

    equals(other: AttendanceSession): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
