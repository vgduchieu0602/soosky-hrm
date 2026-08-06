import EmployeeDirectory from "@modules/performance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/performance/core/app/ports/PermissionChecker";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

/** Khoá gốc quyền XEM phiếu đánh giá. */
export const PERFORMANCE_READ_PERMISSION_KEY = "performance:read";

/** Khoá gốc quyền CHẤM điểm. Không có `:self` — không ai tự chấm cho mình. */
export const PERFORMANCE_REVIEW_PERMISSION_KEY = "performance:review";

/** Quyền quản trị: chu kỳ, bộ tiêu chí, duyệt, khoá điểm. Chỉ HR/Admin. */
export const PERFORMANCE_MANAGE_PERMISSION_KEY = "performance:manage";

/**
 * Phạm vi dữ liệu đánh giá.
 *
 * Bất đối xứng CÓ CHỦ Ý giữa ba nhóm hành động:
 *  - XEM: `all` (HR) / `team` (Manager: mình + cấp dưới) / `self` (nhân viên).
 *  - CHẤM: `all` (HR) / `team` (Manager) — và `team` ở đây KHÔNG gồm bản thân,
 *    vì tự chấm cho mình là xung đột lợi ích hiển nhiên.
 *  - DUYỆT/KHOÁ: chỉ `performance:manage`, tức HR — quản lý chấm nhưng không tự
 *    duyệt rồi tự khoá điểm nhóm mình.
 */
export default class PerformanceAccessScope {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employees: EmployeeDirectory,
    ) {}

    /** @throws {AccessDeniedError} Không có quyền quản trị đánh giá. */
    public async assertCanManage(actorUserId: string): Promise<void> {
        await this._permissions.assertPermission(actorUserId, PERFORMANCE_MANAGE_PERMISSION_KEY);
    }

    /**
     * Tập nhân viên actor được XEM phiếu. `undefined` = không giới hạn.
     *
     * @throws {AccessDeniedError} Không có quyền xem phiếu đánh giá.
     */
    public async visibleEmployeeIds(actorUserId: string): Promise<string[] | undefined> {
        const scope = await this._permissions.resolveScope(actorUserId, PERFORMANCE_READ_PERMISSION_KEY);
        if (scope === "all") return undefined;
        if (scope === "team") return this._employees.listTeamEmployeeIds(actorUserId);

        const own = await this._employees.findEmployeeIdByUserId(actorUserId);
        return own == undefined ? [] : [own];
    }

    /** @throws {AccessDeniedError} Nhân viên này ngoài phạm vi xem của actor. */
    public async assertCanRead(actorUserId: string, employeeId: string): Promise<void> {
        const scope = await this._permissions.resolveScope(actorUserId, PERFORMANCE_READ_PERMISSION_KEY);
        if (scope === "all") return;

        const own = await this._employees.findEmployeeIdByUserId(actorUserId);
        if (own === employeeId) return;

        if (scope === "team" && await this._employees.isManagedBy(employeeId, actorUserId)) return;

        throw new AccessDeniedError();
    }

    /**
     * @throws {AccessDeniedError} Actor không được chấm điểm cho nhân viên này
     *         (kể cả trường hợp tự chấm cho chính mình).
     */
    public async assertCanScore(actorUserId: string, employeeId: string): Promise<void> {
        const scope = await this._permissions.resolveScope(actorUserId, PERFORMANCE_REVIEW_PERMISSION_KEY);
        if (scope === "all") return;

        // `team` = ĐÚNG cấp dưới. Không dùng lối "chính mình thì được" như phía
        // xem: chấm điểm cho bản thân là xung đột lợi ích.
        if (scope === "team" && await this._employees.isManagedBy(employeeId, actorUserId)) return;

        throw new AccessDeniedError();
    }

    /**
     * Nhân viên gắn với tài khoản actor — dùng cho tự xác nhận/khiếu nại phiếu
     * của chính mình.
     *
     * @throws {AccessDeniedError} Actor không gắn với nhân viên nào.
     */
    public async requireOwnEmployeeId(actorUserId: string): Promise<string> {
        const own = await this._employees.findEmployeeIdByUserId(actorUserId);
        if (own == undefined) throw new AccessDeniedError();
        return own;
    }
}
