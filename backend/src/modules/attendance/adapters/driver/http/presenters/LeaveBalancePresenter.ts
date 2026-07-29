import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";

export interface LeaveBalanceDTO {
    id:         string;
    employeeId: string;
    leaveType:  string;
    year:       number;
    entitled:   number;
    used:       number;
    remaining:  number;
}

const LeaveBalancePresenter = {
    toDTO(leaveBalance: LeaveBalance): LeaveBalanceDTO {
        return {
            id:         leaveBalance.id,
            employeeId: leaveBalance.employeeId,
            leaveType:  leaveBalance.leaveType.value,
            year:       leaveBalance.year,
            entitled:   leaveBalance.entitled,
            used:       leaveBalance.used,
            remaining:  leaveBalance.remaining,
        };
    },
};

export default LeaveBalancePresenter;
