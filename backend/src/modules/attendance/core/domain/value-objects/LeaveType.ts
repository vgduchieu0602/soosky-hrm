import LeaveTypeInvalidError from "@modules/attendance/core/domain/errors/LeaveTypeInvalidError";

const MAX_LENGTH = 30;

/**
 * Loại nghỉ phép. `annual` (phép năm, có bể tích luỹ 3 năm) và `unpaid` (nghỉ
 * không lương, không giới hạn) là hai khoá đặc biệt được domain hiểu; các khoá
 * khác (vd: "sick") là hạn mức tuỳ công ty cấu hình qua LeaveBalance.
 */
export default class LeaveType {
    static readonly ANNUAL = new LeaveType("annual");
    static readonly UNPAID = new LeaveType("unpaid");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): LeaveType {
        const key = raw.trim().toLowerCase();

        if (key.length === 0) {
            throw new LeaveTypeInvalidError("Leave type must not be empty");
        }
        if (key.length > MAX_LENGTH) {
            throw new LeaveTypeInvalidError(`Leave type must be at most ${MAX_LENGTH} characters`);
        }
        return new LeaveType(key);
    }

    get isAnnual(): boolean {
        return this.value === LeaveType.ANNUAL.value;
    }

    get isUnpaid(): boolean {
        return this.value === LeaveType.UNPAID.value;
    }

    equals(other: LeaveType): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
