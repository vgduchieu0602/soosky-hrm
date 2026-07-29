import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface LeaveBalanceCreationInput {
    id:         string;
    employeeId: string;
    leaveType:  LeaveType;
    year:       number;
    entitled:   number;
}

export interface LeaveBalanceProps {
    id:         string;
    employeeId: string;
    leaveType:  LeaveType;
    year:       number;
    entitled:   number;
    used:       number;
    createdAt:  Date;
}

/** Aggregate số dư phép của một nhân viên trong một năm, theo loại nghỉ. */
export default class LeaveBalance extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        public readonly leaveType: LeaveType,
        public readonly year: number,
        private _entitled: number,
        private _used: number,
    ) {
        super();
    }

    get entitled(): number {
        return this._entitled;
    }
    get used(): number {
        return this._used;
    }
    get remaining(): number {
        return Math.max(0, this._entitled - this._used);
    }

    static create(input: LeaveBalanceCreationInput): LeaveBalance {
        return new LeaveBalance(input.id, new Date(), input.employeeId, input.leaveType, input.year, input.entitled, 0);
    }

    static rehydrate(props: LeaveBalanceProps): LeaveBalance {
        return new LeaveBalance(props.id, props.createdAt, props.employeeId, props.leaveType, props.year, props.entitled, props.used);
    }

    setEntitled(entitled: number): void {
        this._entitled = entitled;
    }

    incrementUsed(delta: number): void {
        this._used = Math.max(0, this._used + delta);
    }

    setUsed(used: number): void {
        this._used = Math.max(0, used);
    }
}
