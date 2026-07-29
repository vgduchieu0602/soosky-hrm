import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export interface LeaveRequestDTO {
    id:              string;
    employeeId:      string;
    leaveType:       string;
    startDate:       string;
    endDate:         string;
    days:            number;
    halfDaySession:  string | null;
    reason:          string | null;
    status:          string;
    approverId:      string | null;
    approvedAt:      string | null;
    rejectionReason: string | null;
    createdBy:       string;
    createdAt:       string;
}

const LeaveRequestPresenter = {
    toDTO(leaveRequest: LeaveRequest): LeaveRequestDTO {
        return {
            id:              leaveRequest.id,
            employeeId:      leaveRequest.employeeId,
            leaveType:       leaveRequest.leaveType.value,
            startDate:       leaveRequest.startDate.toISOString(),
            endDate:         leaveRequest.endDate.toISOString(),
            days:            leaveRequest.days,
            halfDaySession:  leaveRequest.halfDaySession,
            reason:          leaveRequest.reason,
            status:          leaveRequest.status.value,
            approverId:      leaveRequest.approverId,
            approvedAt:      leaveRequest.approvedAt?.toISOString() ?? null,
            rejectionReason: leaveRequest.rejectionReason,
            createdBy:       leaveRequest.createdBy,
            createdAt:       leaveRequest.createdAt.toISOString(),
        };
    },
};

export default LeaveRequestPresenter;
