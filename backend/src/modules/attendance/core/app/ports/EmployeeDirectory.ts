/**
 * Cổng tra cứu nhân viên mà module Employee sở hữu. Module Attendance cần biết:
 * id nhân viên có tồn tại hay không (chấm công / xin nghỉ), ai là cấp trên của
 * ai (duyệt đơn), và tài khoản đăng nhập nào ứng với nhân viên nào (tự phục vụ).
 *
 * Composition root (infra) lắp hiện thực dựa trên `createEmployeeDirectory` của
 * module Employee.
 */
export default interface EmployeeDirectory {
    employeeExists(employeeId: string): Promise<boolean>;

    /**
     * `employeeId` có nằm dưới quyền quản lý của `actorUserId` không (chuỗi
     * quản lý trực tiếp, mọi tầng) — dùng để Manager chỉ duyệt được đơn của
     * cấp dưới mình.
     */
    isManagedBy(employeeId: string, actorUserId: string): Promise<boolean>;

    /**
     * Nhân viên gắn với một tài khoản đăng nhập — cách duy nhất để biết "actor
     * này là nhân viên nào" khi họ tự nộp đơn cho chính mình.
     */
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;

    /**
     * Chính mình + toàn bộ cấp dưới mọi tầng của `actorUserId`. Mảng rỗng khi
     * actor không gắn với nhân viên nào.
     */
    listTeamEmployeeIds(actorUserId: string): Promise<string[]>;
}
