import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export default interface LeaveRequestRepo {
    getById(id: string): Promise<LeaveRequest | undefined>;
    listByEmployee(employeeId: string): Promise<LeaveRequest[]>;
    listAll(): Promise<LeaveRequest[]>;
    /** Đơn (mọi trạng thái được truyền vào) của nhân viên có khoảng ngày giao với [start, end]. */
    listOverlapping(employeeId: string, start: Date, end: Date, statuses: string[]): Promise<LeaveRequest[]>;
    save(leaveRequest: LeaveRequest): Promise<void>;
}
