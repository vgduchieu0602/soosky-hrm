import PayrollPeriodNameInvalidError from "@modules/payroll/core/domain/errors/PayrollPeriodNameInvalidError";

/** Nhãn duy nhất của một kỳ lương, quy ước `YYYY-MM` (vd "2026-06"). */
export default class PeriodName {
    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): PeriodName {
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
            throw new PayrollPeriodNameInvalidError("Period name must not be empty");
        }
        if (trimmed.length > 40) {
            throw new PayrollPeriodNameInvalidError("Period name must be at most 40 characters");
        }
        return new PeriodName(trimmed);
    }

    equals(other: PeriodName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
