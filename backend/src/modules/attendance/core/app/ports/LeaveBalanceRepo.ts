import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";

export default interface LeaveBalanceRepo {
    getById(id: string): Promise<LeaveBalance | undefined>;
    getOne(employeeId: string, leaveType: string, year: number): Promise<LeaveBalance | undefined>;
    /** Các dòng số dư của nhân viên trong khoảng năm [from, to] (bể cộng dồn phép năm). */
    listInYearWindow(employeeId: string, leaveType: string, from: number, to: number): Promise<LeaveBalance[]>;
    listByEmployeeYear(employeeId: string, year: number): Promise<LeaveBalance[]>;
    save(leaveBalance: LeaveBalance): Promise<void>;
}
