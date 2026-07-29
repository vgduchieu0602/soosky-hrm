import DepartmentStatusInvalidError from "@modules/department/core/domain/errors/DepartmentStatusInvalidError";

/**
 * Trạng thái phòng ban: `active` (đang hoạt động) hoặc `archived` (đã lưu trữ).
 * Là VO bất biến với tập instance cố định để so sánh bằng tham chiếu.
 */
export default class DepartmentStatus {
    static readonly ACTIVE   = new DepartmentStatus("active");
    static readonly ARCHIVED = new DepartmentStatus("archived");

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): DepartmentStatus {
        const found = [DepartmentStatus.ACTIVE, DepartmentStatus.ARCHIVED].find(s => s.value === raw);
        if (found == undefined) {
            throw new DepartmentStatusInvalidError(`Invalid department status: ${raw}`);
        }
        return found;
    }

    get isActive(): boolean {
        return this === DepartmentStatus.ACTIVE;
    }

    equals(other: DepartmentStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
