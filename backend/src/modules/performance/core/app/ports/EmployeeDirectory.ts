/**
 * Cổng tra cứu nhân viên do module Employee sở hữu.
 *
 * Performance cần: ai đang làm việc (để phân công đủ người trong chu kỳ), ai
 * quản lý ai (người chấm mặc định + phạm vi `team`), và tài khoản đăng nhập nào
 * ứng với nhân viên nào (nhân viên tự xem/xác nhận phiếu của mình).
 */
export default interface EmployeeDirectory {
    employeeExists(employeeId: string): Promise<boolean>;
    /** Nhân viên đang `active` — tập bắt buộc phải có điểm trong một chu kỳ. */
    listActiveEmployeeIds(): Promise<string[]>;
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;
    isManagedBy(employeeId: string, actorUserId: string): Promise<boolean>;
    listTeamEmployeeIds(actorUserId: string): Promise<string[]>;
    /** Account của quản lý trực tiếp — người chấm mặc định khi phân công tự động. */
    managerAccountIdOf(employeeId: string): Promise<string | undefined>;
}
