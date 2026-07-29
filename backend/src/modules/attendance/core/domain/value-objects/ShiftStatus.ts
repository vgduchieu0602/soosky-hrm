import ShiftStatusInvalidError from "@modules/attendance/core/domain/errors/ShiftStatusInvalidError";

/**
 * Trạng thái ca làm việc: `active` (đang áp dụng) hoặc `archived` (đã lưu trữ,
 * vẫn giữ để tham chiếu lịch sử chấm công).
 */
export default class ShiftStatus {
    static readonly ACTIVE   = new ShiftStatus("active");
    static readonly ARCHIVED = new ShiftStatus("archived");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): ShiftStatus {
        const found = [ShiftStatus.ACTIVE, ShiftStatus.ARCHIVED].find(s => s.value === raw);
        if (found == undefined) {
            throw new ShiftStatusInvalidError(`Invalid shift status: ${raw}`);
        }
        return found;
    }

    get isActive(): boolean {
        return this === ShiftStatus.ACTIVE;
    }

    equals(other: ShiftStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
