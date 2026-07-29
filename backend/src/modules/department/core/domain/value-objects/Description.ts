import DepartmentNameInvalidError from "@modules/department/core/domain/errors/DepartmentNameInvalidError";

const MAX_LENGTH = 500;

/**
 * Mô tả tuỳ chọn dùng chung cho Department và Position. Rỗng khi không truyền;
 * quá `MAX_LENGTH` ký tự là không hợp lệ.
 */
export default class Description {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw?: string): Description {
        const text = (raw ?? "").trim();
        if (text.length > MAX_LENGTH) {
            throw new DepartmentNameInvalidError(`Description must be at most ${MAX_LENGTH} characters`);
        }
        return new Description(text);
    }

    get isEmpty(): boolean {
        return this.value.length === 0;
    }

    equals(other: Description): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
