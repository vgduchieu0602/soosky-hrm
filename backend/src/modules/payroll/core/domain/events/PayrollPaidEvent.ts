import DomainEvent from "@shared/core/domain/DomainEvent";

export interface PayrollPaidPayload extends Record<string, unknown> {
    periodId: string;
    count:    number;
    paidBy:   string;
}

/** Phát khi Admin đánh dấu toàn bộ dòng lương `approved` của một kỳ là đã thanh toán và khoá kỳ. */
export class PayrollPaidEvent extends DomainEvent<PayrollPaidPayload> {
    static readonly TYPE = "payroll.paid";

    constructor(periodId: string, count: number, paidBy: string) {
        super(PayrollPaidEvent.TYPE, new Date(), { periodId, count, paidBy });
    }
}
