import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";

/**
 * Cổng kiểm tra quyền hạn mà use-case ghi (mutating) của module Attendance cần
 * trước khi thao tác. Module Attendance KHÔNG import trực tiếp module IAM —
 * composition root (infra) lắp hiện thực cụ thể (dựa trên `AccessControl` của
 * IAM) vào cổng này.
 */
export default interface PermissionChecker {
    /**
     * @param actorUserId   Id user thực hiện thao tác.
     * @param permissionKey Quyền hạn cần có (vd: "attendance:manage").
     *
     * @throws {AccessDeniedError} User không giữ quyền hạn này.
     */
    assertPermission(actorUserId: string, permissionKey: string): Promise<void>;

    /**
     * Phạm vi actor được thao tác trên một khoá gốc — `all` (mọi nhân viên),
     * `team` (chỉ cấp dưới), `self` (chỉ chính mình).
     *
     * @throws {AccessDeniedError} User không giữ quyền nào trên khoá này.
     */
    resolveScope(actorUserId: string, permissionKey: string): Promise<PermissionScope>;
}
