import PositionTitleInvalidError from "@modules/department/core/domain/errors/PositionTitleInvalidError";

const MAX_LENGTH = 120;

/** Chức danh vị trí — trim khoảng trắng, giữ nguyên hoa/thường. */
export default class PositionTitle {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PositionTitle {
        const title = raw.trim();

        if (title.length === 0) {
            throw new PositionTitleInvalidError("Position title must not be empty");
        }
        if (title.length > MAX_LENGTH) {
            throw new PositionTitleInvalidError(`Position title must be at most ${MAX_LENGTH} characters`);
        }
        return new PositionTitle(title);
    }

    equals(other: PositionTitle): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
