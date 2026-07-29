/** Dạng document lưu trữ của aggregate `LeaveRequest`. */
export default interface LeaveRequestDocument {
    _id:             string;
    employeeId:      string;
    leaveType:       string;
    startDate:       Date;
    endDate:         Date;
    days:            number;
    halfDaySession:  string | null;
    reason:          string | null;
    status:          string;
    approverId:      string | null;
    approvedAt:      Date | null;
    rejectionReason: string | null;
    createdBy:       string;
    createdAt:       Date;
}
