import EmailInvalidError from "@shared/core/domain/value-objects/email/EmailInvalidError";

const regexValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default class Email {
    private constructor(
        public readonly value: string
    ) {}

    static create(raw: string): Email {
        const value = raw.trim().toLowerCase();
        if (!regexValidEmail.test(value)) throw new EmailInvalidError(raw);

        return new Email(value);
    }

    equals(other: Email): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
