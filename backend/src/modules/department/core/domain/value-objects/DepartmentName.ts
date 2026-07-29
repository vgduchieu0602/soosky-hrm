import DepartmentNameInvalidError from "@modules/department/core/domain/errors/DepartmentNameInvalidError";

const MAX_LENGTH = 120;

/** Tên phòng ban — trim khoảng trắng, giữ nguyên hoa/thường. */
export default class DepartmentName {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): DepartmentName {
        const name = raw.trim();

        if (name.length === 0) {
            throw new DepartmentNameInvalidError("Department name must not be empty");
        }
        if (name.length > MAX_LENGTH) {
            throw new DepartmentNameInvalidError(`Department name must be at most ${MAX_LENGTH} characters`);
        }
        return new DepartmentName(name);
    }

    equals(other: DepartmentName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
