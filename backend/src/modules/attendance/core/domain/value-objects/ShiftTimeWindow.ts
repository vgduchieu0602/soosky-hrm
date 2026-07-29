import ShiftTimeInvalidError from "@modules/attendance/core/domain/errors/ShiftTimeInvalidError";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Khung giờ của một ca làm việc: giờ bắt đầu/kết thúc dạng "HH:mm" và số phút
 * nghỉ giữa ca. `endTime` phải sau `startTime` trong cùng ngày (ca qua đêm
 * không hỗ trợ ở phiên bản này, khớp với dữ liệu cũ).
 */
export default class ShiftTimeWindow {
    private constructor(
        public readonly startTime:    string,
        public readonly endTime:      string,
        public readonly breakMinutes: number,
    ) {}

    static create(startTime: string, endTime: string, breakMinutes: number): ShiftTimeWindow {
        if (!TIME_PATTERN.test(startTime)) {
            throw new ShiftTimeInvalidError(`Invalid start time: ${startTime}`);
        }
        if (!TIME_PATTERN.test(endTime)) {
            throw new ShiftTimeInvalidError(`Invalid end time: ${endTime}`);
        }
        if (breakMinutes < 0) {
            throw new ShiftTimeInvalidError("Break minutes must not be negative");
        }
        if (ShiftTimeWindow.toMinutes(endTime) <= ShiftTimeWindow.toMinutes(startTime)) {
            throw new ShiftTimeInvalidError("Shift end time must be after start time");
        }
        return new ShiftTimeWindow(startTime, endTime, breakMinutes);
    }

    static toMinutes(hhmm: string): number {
        const [h, m] = hhmm.split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
    }

    get startMinutes(): number {
        return ShiftTimeWindow.toMinutes(this.startTime);
    }

    get endMinutes(): number {
        return ShiftTimeWindow.toMinutes(this.endTime);
    }
}
