import DomainEvent from "@shared/core/domain/DomainEvent";

export interface PayrollAttendanceLockedPayload extends Record<string, unknown> {
    periodId:   string;
    periodName: string;
}

/** Phát khi HR chốt chấm công của một kỳ lương. */
export class PayrollAttendanceLockedEvent extends DomainEvent<PayrollAttendanceLockedPayload> {
    static readonly TYPE = "payroll.attendance-locked";

    constructor(periodId: string, periodName: string) {
        super(PayrollAttendanceLockedEvent.TYPE, new Date(), { periodId, periodName });
    }
}
