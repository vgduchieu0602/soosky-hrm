/**
 * Cổng tra cứu sự tồn tại của nhân viên mà module Employee sở hữu. Module
 * Attendance chỉ cần biết id nhân viên có tồn tại hay không khi chấm công /
 * xin nghỉ — composition root (infra) lắp hiện thực dựa trên
 * `createEmployeeDirectory` của module Employee.
 */
export default interface EmployeeDirectory {
    employeeExists(employeeId: string): Promise<boolean>;
}
