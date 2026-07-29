import PersonNameInvalidError from "@modules/employee/core/domain/errors/PersonNameInvalidError";

const MAX_LENGTH = 200;

/** Họ tên đầy đủ của nhân viên — bắt buộc, tối đa {@link MAX_LENGTH} ký tự. */
export default class PersonName {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PersonName {
        const name = raw.trim();

        if (name.length === 0) {
            throw new PersonNameInvalidError("Name must not be empty");
        }
        if (name.length > MAX_LENGTH) {
            throw new PersonNameInvalidError(`Name must be at most ${MAX_LENGTH} characters`);
        }
        return new PersonName(name);
    }

    equals(other: PersonName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
