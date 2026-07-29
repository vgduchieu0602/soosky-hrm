import LeaveStatusInvalidError from "@modules/attendance/core/domain/errors/LeaveStatusInvalidError";

/** Trạng thái đơn xin nghỉ: chờ duyệt / đã duyệt / từ chối / đã huỷ. */
export default class LeaveStatus {
    static readonly PENDING   = new LeaveStatus("pending");
    static readonly APPROVED  = new LeaveStatus("approved");
    static readonly REJECTED  = new LeaveStatus("rejected");
    static readonly CANCELLED = new LeaveStatus("cancelled");

    private static readonly ALL = [
        LeaveStatus.PENDING,
        LeaveStatus.APPROVED,
        LeaveStatus.REJECTED,
        LeaveStatus.CANCELLED,
    ];

    private constructor(
        public readonly value: string,
    ) {}

    static create(raw: string): LeaveStatus {
        const found = LeaveStatus.ALL.find(s => s.value === raw);
        if (found == undefined) {
            throw new LeaveStatusInvalidError(`Invalid leave status: ${raw}`);
        }
        return found;
    }

    get isPending(): boolean {
        return this === LeaveStatus.PENDING;
    }

    get isApproved(): boolean {
        return this === LeaveStatus.APPROVED;
    }

    equals(other: LeaveStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
