import PositionCodeInvalidError from "@modules/department/core/domain/errors/PositionCodeInvalidError";

const MAX_LENGTH = 20;

/** Mã vị trí — chuẩn hoá về UPPERCASE, tối đa {@link MAX_LENGTH} ký tự. */
export default class PositionCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PositionCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new PositionCodeInvalidError("Position code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new PositionCodeInvalidError(`Position code must be at most ${MAX_LENGTH} characters`);
        }
        return new PositionCode(code);
    }

    equals(other: PositionCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
