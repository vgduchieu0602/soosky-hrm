/**
 * Cổng kiểm tra quyền hạn mà use-case ghi (mutating) của module Payroll cần
 * trước khi thao tác. Module Payroll KHÔNG import trực tiếp module IAM —
 * composition root (infra) lắp hiện thực cụ thể (dựa trên `AccessControl` của
 * IAM) vào cổng này.
 */
export default interface PermissionChecker {
    /**
     * @param actorUserId   Id user thực hiện thao tác.
     * @param permissionKey Quyền hạn cần có (vd: "payroll:prepare").
     *
     * @throws {AccessDeniedError} User không giữ quyền hạn này.
     */
    assertPermission(actorUserId: string, permissionKey: string): Promise<void>;

    /** Kiểm tra không ném lỗi — dùng cho phòng thủ theo chiều sâu (vd: HR/Admin xem lương người khác). */
    hasPermission(actorUserId: string, permissionKey: string): Promise<boolean>;
}
