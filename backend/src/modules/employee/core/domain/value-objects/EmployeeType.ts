import EmployeeTypeInvalidError from "@modules/employee/core/domain/errors/EmployeeTypeInvalidError";

/**
 * Loại hình nhân viên: `full_time`, `part_time`, `contract`, `intern`.
 * VO bất biến với tập instance cố định để so sánh bằng tham chiếu.
 */
export default class EmployeeType {
    static readonly FULL_TIME = new EmployeeType("full_time");
    static readonly PART_TIME = new EmployeeType("part_time");
    static readonly CONTRACT  = new EmployeeType("contract");
    static readonly INTERN    = new EmployeeType("intern");

    private static readonly ALL = [
        EmployeeType.FULL_TIME,
        EmployeeType.PART_TIME,
        EmployeeType.CONTRACT,
        EmployeeType.INTERN,
    ];

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): EmployeeType {
        const found = EmployeeType.ALL.find(t => t.value === raw);
        if (found == undefined) {
            throw new EmployeeTypeInvalidError(`Invalid employee type: ${raw}`);
        }
        return found;
    }

    equals(other: EmployeeType): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
