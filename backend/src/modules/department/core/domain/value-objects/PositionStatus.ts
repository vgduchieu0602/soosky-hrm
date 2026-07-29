import PositionStatusInvalidError from "@modules/department/core/domain/errors/PositionStatusInvalidError";

/**
 * Trạng thái vị trí: `active` hoặc `archived`. VO bất biến với tập instance
 * cố định để so sánh bằng tham chiếu.
 */
export default class PositionStatus {
    static readonly ACTIVE   = new PositionStatus("active");
    static readonly ARCHIVED = new PositionStatus("archived");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PositionStatus {
        const found = [PositionStatus.ACTIVE, PositionStatus.ARCHIVED].find(s => s.value === raw);
        if (found == undefined) {
            throw new PositionStatusInvalidError(`Invalid position status: ${raw}`);
        }
        return found;
    }

    get isActive(): boolean {
        return this === PositionStatus.ACTIVE;
    }

    equals(other: PositionStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
