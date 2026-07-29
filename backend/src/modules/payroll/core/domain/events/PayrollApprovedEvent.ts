import DomainEvent from "@shared/core/domain/DomainEvent";

export interface PayrollApprovedPayload extends Record<string, unknown> {
    periodId:    string;
    count:       number;
    approvedBy:  string;
}

/** Phát khi HR/Admin duyệt các dòng lương `draft` của một kỳ (toàn bộ hoặc một nhân viên). */
export class PayrollApprovedEvent extends DomainEvent<PayrollApprovedPayload> {
    static readonly TYPE = "payroll.approved";

    constructor(periodId: string, count: number, approvedBy: string) {
        super(PayrollApprovedEvent.TYPE, new Date(), { periodId, count, approvedBy });
    }
}
