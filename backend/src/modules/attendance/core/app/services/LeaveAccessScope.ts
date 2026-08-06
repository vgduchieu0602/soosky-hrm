import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import SubjectScope from "@modules/attendance/core/app/services/SubjectScope";

/** Khoá gốc quyền NỘP/HUỶ đơn nghỉ. */
export const LEAVE_SUBMIT_PERMISSION_KEY = "leave:submit";

/** Khoá gốc quyền XEM đơn nghỉ và số dư phép. */
export const LEAVE_READ_PERMISSION_KEY = "leave:read";

/**
 * Phạm vi cho nghiệp vụ đơn nghỉ — lớp đặt tên mỏng trên {@link SubjectScope},
 * để use-case gọi bằng ngôn ngữ nghiệp vụ ("được nộp cho ai") thay vì tự nhớ
 * khoá quyền nào.
 *
 * Ba phạm vi:
 *  - `all`  → HR/Admin: mọi nhân viên (HR nộp thay).
 *  - `team` → Manager: chính mình + cấp dưới mọi tầng.
 *  - `self` → Employee: chỉ chính mình.
 *
 * Nộp (`leave:submit`) và xem (`leave:read`) tách thành hai khoá vì thực tế
 * chúng lệch nhau theo vai.
 */
export default class LeaveAccessScope {
    private readonly _scope: SubjectScope;

    public constructor(permissions: PermissionChecker, employees: EmployeeDirectory) {
        this._scope = new SubjectScope(permissions, employees);
    }

    /**
     * Nhân viên xin nghỉ. Bỏ trống = "tôi nộp cho chính tôi".
     *
     * @throws {AccessDeniedError} Không có quyền nộp, ngoài phạm vi, hoặc actor
     *                             không gắn với nhân viên nào.
     */
    public async resolveSubjectEmployeeId(actorUserId: string, requestedEmployeeId?: string | undefined): Promise<string> {
        return this._scope.resolveSubject(actorUserId, LEAVE_SUBMIT_PERMISSION_KEY, requestedEmployeeId);
    }

    /**
     * Đối ngẫu cho phía ĐỌC: bỏ trống = "đơn/số dư của chính tôi".
     *
     * @throws {AccessDeniedError} Không có quyền xem, ngoài phạm vi, hoặc actor
     *                             không gắn với nhân viên nào.
     */
    public async resolveReadSubjectEmployeeId(actorUserId: string, requestedEmployeeId?: string | undefined): Promise<string> {
        return this._scope.resolveSubject(actorUserId, LEAVE_READ_PERMISSION_KEY, requestedEmployeeId);
    }

    /**
     * @throws {AccessDeniedError} Actor không được nộp/huỷ đơn cho nhân viên này.
     */
    public async assertCanSubmitFor(actorUserId: string, employeeId: string): Promise<void> {
        await this._scope.assertInScope(actorUserId, LEAVE_SUBMIT_PERMISSION_KEY, employeeId);
    }

    /**
     * @throws {AccessDeniedError} Actor không được xem đơn/số dư của nhân viên này.
     */
    public async assertCanRead(actorUserId: string, employeeId: string): Promise<void> {
        await this._scope.assertInScope(actorUserId, LEAVE_READ_PERMISSION_KEY, employeeId);
    }

    /**
     * Tập id nhân viên mà actor được XEM đơn/số dư. `undefined` = không giới hạn.
     *
     * @throws {AccessDeniedError} Actor không có quyền xem đơn nghỉ.
     */
    public async visibleEmployeeIds(actorUserId: string): Promise<string[] | undefined> {
        return this._scope.visibleEmployeeIds(actorUserId, LEAVE_READ_PERMISSION_KEY);
    }
}
