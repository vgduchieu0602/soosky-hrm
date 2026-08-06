import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";

/**
 * Cổng kiểm tra quyền hạn của module Performance. Module KHÔNG import IAM —
 * composition root lắp hiện thực dựa trên `AccessControl` của IAM.
 */
export default interface PermissionChecker {
    /** @throws {AccessDeniedError} User không giữ quyền hạn này. */
    assertPermission(actorUserId: string, permissionKey: string): Promise<void>;

    /** @throws {AccessDeniedError} User không giữ quyền nào trên khoá này. */
    resolveScope(actorUserId: string, permissionKey: string): Promise<PermissionScope>;
}
