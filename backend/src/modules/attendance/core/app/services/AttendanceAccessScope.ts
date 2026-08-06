import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import SubjectScope from "@modules/attendance/core/app/services/SubjectScope";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

/** Khoá gốc quyền XEM bảng công. GHI chấm công là `attendance:manage`, không có bản thu hẹp. */
export const ATTENDANCE_READ_PERMISSION_KEY = "attendance:read";

/** Khoá gốc quyền GỬI yêu cầu chỉnh công. */
export const CORRECTION_SUBMIT_PERMISSION_KEY = "correction:submit";

/** Khoá gốc quyền DUYỆT/TỪ CHỐI yêu cầu chỉnh công. Không có bản `:self` — không ai tự duyệt cho mình. */
export const CORRECTION_APPROVE_PERMISSION_KEY = "correction:approve";

/**
 * Phạm vi cho bảng công và luồng chỉnh công — lớp đặt tên mỏng trên
 * {@link SubjectScope}.
 *
 * Bất đối xứng CÓ CHỦ Ý giữa đọc và ghi: nhân viên XEM được bảng công của mình
 * và GỬI được yêu cầu chỉnh, nhưng không bao giờ tự ghi vào bảng công — mọi
 * thay đổi đi qua HR hoặc qua yêu cầu chỉnh công được duyệt.
 */
export default class AttendanceAccessScope {
    private readonly _scope: SubjectScope;

    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employees: EmployeeDirectory,
    ) {
        this._scope = new SubjectScope(_permissions, _employees);
    }

    /**
     * Nhân viên cần xem bảng công. Bỏ trống = "bảng công của chính tôi".
     *
     * @throws {AccessDeniedError} Không có quyền xem, ngoài phạm vi, hoặc actor
     *                             không gắn với nhân viên nào.
     */
    public async resolveReadSubjectEmployeeId(actorUserId: string, requestedEmployeeId?: string | undefined): Promise<string> {
        return this._scope.resolveSubject(actorUserId, ATTENDANCE_READ_PERMISSION_KEY, requestedEmployeeId);
    }

    /**
     * Tập id nhân viên mà actor được XEM bảng công. `undefined` = không giới hạn
     * (phạm vi `all`) — dùng cho lưới chấm công nhiều người.
     *
     * @throws {AccessDeniedError} Actor không có quyền xem bảng công.
     */
    public async visibleAttendanceEmployeeIds(actorUserId: string): Promise<string[] | undefined> {
        return this._scope.visibleEmployeeIds(actorUserId, ATTENDANCE_READ_PERMISSION_KEY);
    }

    /**
     * @throws {AccessDeniedError} Actor không được xem bảng công của nhân viên này.
     */
    public async assertCanRead(actorUserId: string, employeeId: string): Promise<void> {
        await this._scope.assertInScope(actorUserId, ATTENDANCE_READ_PERMISSION_KEY, employeeId);
    }

    /**
     * Nhân viên được nêu trong yêu cầu chỉnh công. Bỏ trống = "yêu cầu cho chính tôi".
     *
     * @throws {AccessDeniedError} Không có quyền gửi, ngoài phạm vi, hoặc actor
     *                             không gắn với nhân viên nào.
     */
    public async resolveCorrectionSubjectEmployeeId(actorUserId: string, requestedEmployeeId?: string | undefined): Promise<string> {
        return this._scope.resolveSubject(actorUserId, CORRECTION_SUBMIT_PERMISSION_KEY, requestedEmployeeId);
    }

    /**
     * Tập id nhân viên mà actor được XEM yêu cầu chỉnh công. `undefined` = không
     * giới hạn. Dùng chung khoá với gửi: thấy được đúng những người mình gửi
     * thay được.
     *
     * @throws {AccessDeniedError} Actor không có quyền nào trên chỉnh công.
     */
    public async visibleCorrectionEmployeeIds(actorUserId: string): Promise<string[] | undefined> {
        return this._scope.visibleEmployeeIds(actorUserId, CORRECTION_SUBMIT_PERMISSION_KEY);
    }

    /**
     * @throws {AccessDeniedError} Actor không được xem yêu cầu của nhân viên này.
     */
    public async assertCanReadCorrection(actorUserId: string, employeeId: string): Promise<void> {
        await this._scope.assertInScope(actorUserId, CORRECTION_SUBMIT_PERMISSION_KEY, employeeId);
    }

    /**
     * Ai được quyết định một yêu cầu chỉnh công: HR mọi người, Manager cấp dưới.
     *
     * KHÔNG dùng `SubjectScope.assertInScope` ở đây: quy tắc "chính mình thì
     * được" của nó là đúng cho gửi/xem nhưng SAI cho duyệt — nó sẽ cho Manager
     * tự duyệt yêu cầu chỉnh công của chính mình. Phạm vi `team` ở đây nghĩa là
     * ĐÚNG cấp dưới, không gồm bản thân.
     *
     * @throws {AccessDeniedError} Actor không được duyệt yêu cầu của nhân viên này.
     */
    public async assertCanDecideCorrection(actorUserId: string, employeeId: string): Promise<void> {
        const scope = await this._permissions.resolveScope(actorUserId, CORRECTION_APPROVE_PERMISSION_KEY);
        if (scope === "all") return;

        if (scope === "team" && await this._employees.isManagedBy(employeeId, actorUserId)) return;

        throw new AccessDeniedError();
    }
}
