import HolidayNameInvalidError from "@modules/attendance/core/domain/errors/HolidayNameInvalidError";

const MAX_LENGTH = 200;

/** Tên ngày lễ — không rỗng, tối đa {@link MAX_LENGTH} ký tự. */
export default class HolidayName {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): HolidayName {
        const name = raw.trim();

        if (name.length === 0) {
            throw new HolidayNameInvalidError("Holiday name must not be empty");
        }
        if (name.length > MAX_LENGTH) {
            throw new HolidayNameInvalidError(`Holiday name must be at most ${MAX_LENGTH} characters`);
        }
        return new HolidayName(name);
    }

    equals(other: HolidayName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
