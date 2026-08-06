import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";

export interface LeaveListFilter {
    employeeIds?: readonly string[] | undefined;
    status?:      string | undefined;
    /** Chỉ lấy đơn có `startDate >= startFrom`. */
    startFrom?:   Date | undefined;
}

export default interface LeaveRequestRepo {
    getById(id: string): Promise<LeaveRequest | undefined>;
    listByEmployee(employeeId: string): Promise<LeaveRequest[]>;
    listAll(): Promise<LeaveRequest[]>;
    /**
     * Đơn theo bộ lọc — dùng cho hàng chờ duyệt và danh sách đơn sắp tới của bảng
     * điều khiển. Có filter để KHÔNG phải tải toàn bộ collection rồi lọc trong app.
     */
    list(filter: LeaveListFilter): Promise<LeaveRequest[]>;
    /** Đơn (mọi trạng thái được truyền vào) của nhân viên có khoảng ngày giao với [start, end]. */
    listOverlapping(employeeId: string, start: Date, end: Date, statuses: string[]): Promise<LeaveRequest[]>;
    save(leaveRequest: LeaveRequest): Promise<void>;
}
