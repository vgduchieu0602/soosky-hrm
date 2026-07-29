import SymbolCodeInvalidError from "@modules/attendance/core/domain/errors/SymbolCodeInvalidError";

const MAX_LENGTH = 10;

/** Mã ký hiệu chấm công (vd: "P", "KL", "NB") — UPPERCASE, tối đa {@link MAX_LENGTH} ký tự. */
export default class SymbolCode {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): SymbolCode {
        const code = raw.trim().toUpperCase();

        if (code.length === 0) {
            throw new SymbolCodeInvalidError("Symbol code must not be empty");
        }
        if (code.length > MAX_LENGTH) {
            throw new SymbolCodeInvalidError(`Symbol code must be at most ${MAX_LENGTH} characters`);
        }
        return new SymbolCode(code);
    }

    equals(other: SymbolCode): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
