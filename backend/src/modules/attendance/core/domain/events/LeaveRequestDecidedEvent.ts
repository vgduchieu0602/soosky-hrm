import DomainEvent from "@shared/core/domain/DomainEvent";

export interface LeaveRequestDecidedPayload extends Record<string, unknown> {
    leaveRequestId: string;
    employeeId:     string;
    approved:       boolean;
    reason?:        string;
}

/** Phát khi một đơn xin nghỉ được duyệt hoặc từ chối. */
export class LeaveRequestDecidedEvent extends DomainEvent<LeaveRequestDecidedPayload> {
    static readonly TYPE = "attendance.leave.decided";

    constructor(leaveRequestId: string, employeeId: string, approved: boolean, reason?: string) {
        super(LeaveRequestDecidedEvent.TYPE, new Date(), {
            leaveRequestId, employeeId, approved,
            ...(reason != undefined ? { reason } : {}),
        });
    }
}
