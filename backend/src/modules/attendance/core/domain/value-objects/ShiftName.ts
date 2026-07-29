import ShiftNameInvalidError from "@modules/attendance/core/domain/errors/ShiftNameInvalidError";

const MAX_LENGTH = 200;

/** Tên ca làm việc — không rỗng, tối đa {@link MAX_LENGTH} ký tự. */
export default class ShiftName {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): ShiftName {
        const name = raw.trim();

        if (name.length === 0) {
            throw new ShiftNameInvalidError("Shift name must not be empty");
        }
        if (name.length > MAX_LENGTH) {
            throw new ShiftNameInvalidError(`Shift name must be at most ${MAX_LENGTH} characters`);
        }
        return new ShiftName(name);
    }

    equals(other: ShiftName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
