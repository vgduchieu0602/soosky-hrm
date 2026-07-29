/** Dạng document lưu trữ của aggregate `LeaveBalance`. */
export default interface LeaveBalanceDocument {
    _id:        string;
    employeeId: string;
    leaveType:  string;
    year:       number;
    entitled:   number;
    used:       number;
    createdAt:  Date;
}
