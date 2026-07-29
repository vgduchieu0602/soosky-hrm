import DomainEvent from "@shared/core/domain/DomainEvent";

export interface LeaveRequestSubmittedPayload extends Record<string, unknown> {
    leaveRequestId: string;
    employeeId:     string;
}

/** Phát khi một đơn xin nghỉ được nộp — module khác (vd: thông báo) có thể lắng nghe. */
export class LeaveRequestSubmittedEvent extends DomainEvent<LeaveRequestSubmittedPayload> {
    static readonly TYPE = "attendance.leave.submitted";

    constructor(leaveRequestId: string, employeeId: string) {
        super(LeaveRequestSubmittedEvent.TYPE, new Date(), { leaveRequestId, employeeId });
    }
}
