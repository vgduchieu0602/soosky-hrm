import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

/** Khoá gốc quyền duyệt/từ chối đơn nghỉ. */
export const LEAVE_APPROVE_PERMISSION_KEY = "leave:approve";

/**
 * Ai được quyết định (duyệt/từ chối) một đơn nghỉ.
 *
 *  - `all`  → HR/Admin: mọi đơn.
 *  - `team` → Manager: chỉ đơn của cấp dưới mình, xét theo chuỗi quản lý trực
 *             tiếp mọi tầng.
 *  - `self` → không ai tự duyệt đơn của chính mình.
 *
 * Tách thành service riêng vì cả duyệt và từ chối đều cần đúng một quy tắc —
 * để hai use-case tự kiểm tra là sớm muộn cũng lệch nhau.
 */
export default class LeaveDecisionAuthorizer {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employees: EmployeeDirectory,
    ) {}

    /**
     * @throws {AccessDeniedError} Actor không được quyết định đơn của nhân viên này.
     */
    public async assertCanDecide(actorUserId: string, employeeId: string): Promise<void> {
        const scope = await this._permissions.resolveScope(actorUserId, LEAVE_APPROVE_PERMISSION_KEY);
        if (scope === "all") return;

        if (scope === "team" && await this._employees.isManagedBy(employeeId, actorUserId)) return;

        throw new AccessDeniedError();
    }
}
