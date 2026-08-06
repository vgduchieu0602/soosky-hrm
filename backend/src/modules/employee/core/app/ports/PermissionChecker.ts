import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";

/**
 * Cổng kiểm tra quyền hạn mà use-case của module Employee cần trước khi thao
 * tác. Module Employee KHÔNG import trực tiếp module IAM — composition root
 * (infra) lắp hiện thực cụ thể (dựa trên `AccessControl` của IAM) vào cổng này.
 */
export default interface PermissionChecker {
    /**
     * @param actorUserId   Id user thực hiện thao tác.
     * @param permissionKey Quyền hạn cần có (vd: "employee:manage").
     *
     * @throws {AccessDeniedError} User không giữ quyền hạn này.
     */
    assertPermission(actorUserId: string, permissionKey: string): Promise<void>;

    /**
     * Phân giải PHẠM VI dữ liệu actor được phép đọc trên một khoá gốc
     * (vd `employee:read` → `all` cho HR, `team` cho Manager, `self` cho
     * Employee). Dùng cho use-case ĐỌC: không chỉ trả lời "được hay không" mà
     * còn "được tới đâu".
     *
     * @throws {AccessDeniedError} User không giữ quyền nào trên khoá này.
     */
    resolveScope(actorUserId: string, permissionKey: string): Promise<PermissionScope>;
}
