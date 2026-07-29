import PositionLevelInvalidError from "@modules/department/core/domain/errors/PositionLevelInvalidError";

const MIN = 1;
const MAX = 10;

/** Cấp bậc vị trí — số nguyên trong khoảng [{@link MIN}, {@link MAX}]. */
export default class PositionLevel {
    private constructor(
        public readonly value: number,
    ) {}

    static create(raw: number): PositionLevel {
        if (Number.isInteger(raw) === false) {
            throw new PositionLevelInvalidError("Position level must be an integer");
        }
        if (raw < MIN || raw > MAX) {
            throw new PositionLevelInvalidError(`Position level must be between ${MIN} and ${MAX}`);
        }
        return new PositionLevel(raw);
    }

    equals(other: PositionLevel): boolean {
        return this.value === other.value;
    }
}
