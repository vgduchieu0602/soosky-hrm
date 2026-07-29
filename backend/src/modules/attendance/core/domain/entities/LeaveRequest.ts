import LeaveDateRangeInvalidError from "@modules/attendance/core/domain/errors/LeaveDateRangeInvalidError";
import LeaveStatus from "@modules/attendance/core/domain/value-objects/LeaveStatus";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface LeaveRequestCreationInput {
    id:             string;
    employeeId:     string;
    leaveType:      LeaveType;
    startDate:      Date;
    endDate:        Date;
    days:           number;
    halfDaySession: string | null;
    reason:         string | null;
    createdBy:      string;
}

export interface LeaveRequestProps {
    id:              string;
    employeeId:      string;
    leaveType:       LeaveType;
    startDate:       Date;
    endDate:         Date;
    days:            number;
    halfDaySession:  string | null;
    reason:          string | null;
    status:          LeaveStatus;
    approverId:      string | null;
    approvedAt:      Date | null;
    rejectionReason: string | null;
    createdBy:       string;
    createdAt:       Date;
}

/**
 * Aggregate đơn xin nghỉ phép. Ràng buộc bất biến ngay khi tạo: ngày kết thúc
 * không trước ngày bắt đầu, và nghỉ nửa ngày chỉ áp dụng trong cùng một ngày
 * (port từ `leave.usecases.ts` bản cũ, LV_003/LV_006).
 */
export default class LeaveRequest extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        public readonly leaveType: LeaveType,
        public readonly startDate: Date,
        public readonly endDate: Date,
        public readonly days: number,
        public readonly halfDaySession: string | null,
        private _reason: string | null,
        private _status: LeaveStatus,
        private _approverId: string | null,
        private _approvedAt: Date | null,
        private _rejectionReason: string | null,
        public readonly createdBy: string,
    ) {
        super();
    }

    get reason(): string | null {
        return this._reason;
    }
    get status(): LeaveStatus {
        return this._status;
    }
    get approverId(): string | null {
        return this._approverId;
    }
    get approvedAt(): Date | null {
        return this._approvedAt;
    }
    get rejectionReason(): string | null {
        return this._rejectionReason;
    }

    static create(input: LeaveRequestCreationInput): LeaveRequest {
        if (input.endDate.getTime() < input.startDate.getTime()) {
            throw new LeaveDateRangeInvalidError("Leave end date must not be before start date");
        }
        if (input.halfDaySession != undefined) {
            const sameDay = LeaveRequest._dateKey(input.startDate) === LeaveRequest._dateKey(input.endDate);
            if (!sameDay) {
                throw new LeaveDateRangeInvalidError("Half-day leave must be within a single day");
            }
        }
        if (input.days <= 0) {
            throw new LeaveDateRangeInvalidError("Leave range has no working day");
        }
        return new LeaveRequest(
            input.id, new Date(), input.employeeId, input.leaveType, input.startDate, input.endDate,
            input.days, input.halfDaySession ?? null, input.reason ?? null,
            LeaveStatus.PENDING, null, null, null, input.createdBy,
        );
    }

    static rehydrate(props: LeaveRequestProps): LeaveRequest {
        return new LeaveRequest(
            props.id, props.createdAt, props.employeeId, props.leaveType, props.startDate, props.endDate,
            props.days, props.halfDaySession, props.reason,
            props.status, props.approverId, props.approvedAt, props.rejectionReason, props.createdBy,
        );
    }

    approve(approverId: string, approvedAt: Date): void {
        this._status = LeaveStatus.APPROVED;
        this._approverId = approverId;
        this._approvedAt = approvedAt;
    }

    reject(approverId: string, reason: string, decidedAt: Date): void {
        this._status = LeaveStatus.REJECTED;
        this._approverId = approverId;
        this._approvedAt = decidedAt;
        this._rejectionReason = reason;
    }

    cancel(reason: string | null = null): void {
        this._status = LeaveStatus.CANCELLED;
        this._rejectionReason = reason;
    }

    private static _dateKey(d: Date): number {
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
}
