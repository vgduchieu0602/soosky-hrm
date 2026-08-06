import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

/**
 * Phân giải "actor này được thao tác trên dữ liệu của những nhân viên nào" cho
 * MỘT khoá quyền gốc bất kỳ.
 *
 * Module Attendance có nhiều nhóm hành động cùng cần đúng một logic phạm vi
 * (xem bảng công, nộp đơn nghỉ, xem đơn nghỉ, gửi yêu cầu chỉnh công, duyệt
 * chỉnh công). Gom vào một chỗ để chúng không bao giờ lệch nhau; các service
 * chuyên biệt (`LeaveAccessScope`, `AttendanceAccessScope`, ...) chỉ là lớp
 * đặt tên mỏng gọi vào đây với đúng khoá của mình.
 *
 * Actor được nhận diện qua `accountId` của nhân viên. Actor phạm vi
 * `team`/`self` mà không gắn nhân viên nào (tài khoản quản trị thuần) thì không
 * thao tác được gì — cố ý: thà chặn còn hơn mở toàn bộ vì thiếu liên kết.
 */
export default class SubjectScope {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employees: EmployeeDirectory,
    ) {}

    /**
     * Nhân viên mà actor đang thao tác trên. Bỏ trống `requestedEmployeeId` =
     * "chính tôi" — đây là cách DUY NHẤT giao diện tự phục vụ nên dùng, vì
     * client không cần (và không được) tự gửi id để tránh mạo danh.
     *
     * @throws {AccessDeniedError} Không có quyền, ngoài phạm vi, hoặc actor
     *                             không gắn với nhân viên nào.
     */
    public async resolveSubject(actorUserId: string, baseKey: string, requestedEmployeeId?: string | undefined): Promise<string> {
        if (requestedEmployeeId != undefined) {
            await this.assertInScope(actorUserId, baseKey, requestedEmployeeId);
            return requestedEmployeeId;
        }

        await this._permissions.resolveScope(actorUserId, baseKey);

        const own = await this._employees.findEmployeeIdByUserId(actorUserId);
        if (own == undefined) throw new AccessDeniedError();
        return own;
    }

    /**
     * @throws {AccessDeniedError} Nhân viên này ngoài phạm vi của actor.
     */
    public async assertInScope(actorUserId: string, baseKey: string, employeeId: string): Promise<void> {
        const scope = await this._permissions.resolveScope(actorUserId, baseKey);
        if (scope === "all") return;

        const own = await this._employees.findEmployeeIdByUserId(actorUserId);
        if (own === employeeId) return;   // chính mình — đúng với cả `team` lẫn `self`

        if (scope === "team" && await this._employees.isManagedBy(employeeId, actorUserId)) return;

        throw new AccessDeniedError();
    }

    /**
     * Tập id nhân viên trong phạm vi. `undefined` = không giới hạn (`all`).
     *
     * @throws {AccessDeniedError} Actor không có quyền nào trên khoá này.
     */
    public async visibleEmployeeIds(actorUserId: string, baseKey: string): Promise<string[] | undefined> {
        const scope = await this._permissions.resolveScope(actorUserId, baseKey);
        if (scope === "all") return undefined;

        if (scope === "team") return this._employees.listTeamEmployeeIds(actorUserId);

        const own = await this._employees.findEmployeeIdByUserId(actorUserId);
        return own == undefined ? [] : [own];
    }
}
