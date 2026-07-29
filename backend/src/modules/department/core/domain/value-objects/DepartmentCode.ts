import DepartmentCodeInvalidError from "@modules/department/core/domain/errors/DepartmentCodeInvalidError";

const MAX_LENGTH = 20;

/** Mã phòng ban — chuẩn hoá về UPPERCASE, tối đa {@link MAX_LENGTH} ký tự. */
export default class DepartmentCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): DepartmentCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new DepartmentCodeInvalidError("Department code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new DepartmentCodeInvalidError(`Department code must be at most ${MAX_LENGTH} characters`);
        }
        return new DepartmentCode(code);
    }

    equals(other: DepartmentCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
