import ShiftCodeInvalidError from "@modules/attendance/core/domain/errors/ShiftCodeInvalidError";

const MAX_LENGTH = 20;

/** Mã ca làm việc — chuẩn hoá về UPPERCASE, tối đa {@link MAX_LENGTH} ký tự. */
export default class ShiftCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): ShiftCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new ShiftCodeInvalidError("Shift code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new ShiftCodeInvalidError(`Shift code must be at most ${MAX_LENGTH} characters`);
        }
        return new ShiftCode(code);
    }

    equals(other: ShiftCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
