import FullNameInvalidError from "@modules/auth/core/domain/errors/FullNameInvalidError";

export default class FullName {
    private constructor(
        public readonly value: string
    ) {}

    static create(raw: string): FullName {
        const name = raw.trim();

        if (!name.length) {
            throw new FullNameInvalidError("Full name must not be empty");
        }
        return new FullName(name);
    }

    equals(other: FullName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
