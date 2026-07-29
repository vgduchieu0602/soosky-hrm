import EmployeeStatusInvalidError from "@modules/employee/core/domain/errors/EmployeeStatusInvalidError";

/**
 * Trạng thái nhân viên: `onboarding`, `active`, `on_leave`, `terminated`.
 * VO bất biến với tập instance cố định để so sánh bằng tham chiếu.
 */
export default class EmployeeStatus {
    static readonly ONBOARDING = new EmployeeStatus("onboarding");
    static readonly ACTIVE     = new EmployeeStatus("active");
    static readonly ON_LEAVE   = new EmployeeStatus("on_leave");
    static readonly TERMINATED = new EmployeeStatus("terminated");

    private static readonly ALL = [
        EmployeeStatus.ONBOARDING,
        EmployeeStatus.ACTIVE,
        EmployeeStatus.ON_LEAVE,
        EmployeeStatus.TERMINATED,
    ];

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): EmployeeStatus {
        const found = EmployeeStatus.ALL.find(s => s.value === raw);
        if (found == undefined) {
            throw new EmployeeStatusInvalidError(`Invalid employee status: ${raw}`);
        }
        return found;
    }

    get isActive(): boolean {
        return this === EmployeeStatus.ACTIVE;
    }

    get isTerminated(): boolean {
        return this === EmployeeStatus.TERMINATED;
    }

    equals(other: EmployeeStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
