import EmployeeCodeInvalidError from "@modules/employee/core/domain/errors/EmployeeCodeInvalidError";

const MAX_LENGTH = 20;

/** Mã nhân viên — chuẩn hoá về UPPERCASE, tối đa {@link MAX_LENGTH} ký tự. */
export default class EmployeeCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): EmployeeCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new EmployeeCodeInvalidError("Employee code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new EmployeeCodeInvalidError(`Employee code must be at most ${MAX_LENGTH} characters`);
        }
        return new EmployeeCode(code);
    }

    equals(other: EmployeeCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
