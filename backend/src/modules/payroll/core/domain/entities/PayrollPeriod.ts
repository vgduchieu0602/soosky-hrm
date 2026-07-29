import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const PAYROLL_PERIOD_STATUSES = ["open", "processing", "closed", "paid"] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

export interface PayrollPeriodCreationInput {
    id:               string;
    name:             PeriodName;
    startDate:        Date;
    endDate:          Date;
    payDate:          Date;
    standardWorkDays: number;
    createdBy:        string | null;
}

export interface PayrollPeriodProps {
    id:                    string;
    name:                  PeriodName;
    startDate:             Date;
    endDate:               Date;
    payDate:               Date;
    standardWorkDays:      number;
    status:                PayrollPeriodStatus;
    closedAt:              Date | null;
    closedBy:              string | null;
    attendanceLockedAt:    Date | null;
    attendanceLockedBy:    string | null;
    evaluationLockedAt:    Date | null;
    evaluationLockedBy:    string | null;
    createdBy:             string | null;
    createdAt:             Date;
}

/**
 * Aggregate kỳ lương — một kỳ dùng chung cho chấm công, đánh giá và bảng
 * lương. Vòng đời: `open` → (chốt chấm công + chốt đánh giá) → tính lương
 * (draft) → duyệt (`processing`) → thanh toán (`paid`); hoặc `open` → `closed`
 * trực tiếp (chốt kỳ không qua thanh toán). Guard nghiệp vụ (không đóng khi
 * còn draft, không sửa khi đã khoá, …) nằm ở tầng use-case (cần đọc
 * `PayslipRepo`) — entity chỉ giữ trạng thái.
 */
export default class PayrollPeriod extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _name: PeriodName,
        private _startDate: Date,
        private _endDate: Date,
        private _payDate: Date,
        private _standardWorkDays: number,
        private _status: PayrollPeriodStatus,
        private _closedAt: Date | null,
        private _closedBy: string | null,
        private _attendanceLockedAt: Date | null,
        private _attendanceLockedBy: string | null,
        private _evaluationLockedAt: Date | null,
        private _evaluationLockedBy: string | null,
        private _createdBy: string | null,
    ) {
        super();
    }

    get name(): PeriodName { return this._name; }
    get startDate(): Date { return this._startDate; }
    get endDate(): Date { return this._endDate; }
    get payDate(): Date { return this._payDate; }
    get standardWorkDays(): number { return this._standardWorkDays; }
    get status(): PayrollPeriodStatus { return this._status; }
    get closedAt(): Date | null { return this._closedAt; }
    get closedBy(): string | null { return this._closedBy; }
    get attendanceLockedAt(): Date | null { return this._attendanceLockedAt; }
    get attendanceLockedBy(): string | null { return this._attendanceLockedBy; }
    get evaluationLockedAt(): Date | null { return this._evaluationLockedAt; }
    get evaluationLockedBy(): string | null { return this._evaluationLockedBy; }
    get createdBy(): string | null { return this._createdBy; }

    /** Cả hai chốt (chấm công + đánh giá) đã xong — đủ điều kiện tự động chạy lương. */
    get isFullyLocked(): boolean {
        return this._attendanceLockedAt != null && this._evaluationLockedAt != null;
    }

    static create(input: PayrollPeriodCreationInput): PayrollPeriod {
        return new PayrollPeriod(
            input.id, new Date(), input.name, input.startDate, input.endDate, input.payDate,
            input.standardWorkDays, "open", null, null, null, null, null, null, input.createdBy,
        );
    }

    static rehydrate(props: PayrollPeriodProps): PayrollPeriod {
        return new PayrollPeriod(
            props.id, props.createdAt, props.name, props.startDate, props.endDate, props.payDate,
            props.standardWorkDays, props.status, props.closedAt, props.closedBy,
            props.attendanceLockedAt, props.attendanceLockedBy,
            props.evaluationLockedAt, props.evaluationLockedBy, props.createdBy,
        );
    }

    update(patch: { endDate?: Date; payDate?: Date; standardWorkDays?: number }): void {
        if (patch.endDate != undefined) this._endDate = patch.endDate;
        if (patch.payDate != undefined) this._payDate = patch.payDate;
        if (patch.standardWorkDays != undefined) this._standardWorkDays = patch.standardWorkDays;
    }

    close(byUserId: string): void {
        this._status = "closed";
        this._closedAt = new Date();
        this._closedBy = byUserId;
    }

    reopen(): void {
        this._status = "open";
        this._closedAt = null;
        this._closedBy = null;
    }

    lockAttendance(byUserId: string): void {
        this._attendanceLockedAt = new Date();
        this._attendanceLockedBy = byUserId;
    }

    unlockAttendance(): void {
        this._attendanceLockedAt = null;
        this._attendanceLockedBy = null;
    }

    lockEvaluations(byUserId: string): void {
        this._evaluationLockedAt = new Date();
        this._evaluationLockedBy = byUserId;
    }

    unlockEvaluations(): void {
        this._evaluationLockedAt = null;
        this._evaluationLockedBy = null;
    }

    markProcessing(): void {
        this._status = "processing";
    }

    markPaid(): void {
        this._status = "paid";
    }
}
