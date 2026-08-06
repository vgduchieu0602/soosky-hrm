import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

/** Khoá gốc dùng để phân giải phạm vi đọc hồ sơ nhân viên. */
export const EMPLOYEE_READ_PERMISSION_KEY = "employee:read";

/**
 * Chặn vòng lặp nếu dữ liệu quản lý bị tạo vòng (A quản B, B quản A) — dựng
 * chuỗi cấp dưới vẫn phải dừng. Cũng là trần an toàn cho cây rất sâu.
 */
const MAX_MANAGER_CHAIN_DEPTH = 50;

/**
 * Dịch vụ phân giải PHẠM VI dữ liệu nhân viên mà một actor được đọc — nơi duy
 * nhất trong module Employee biết cách dịch quyền hạn thành "tập nhân viên
 * nhìn thấy được".
 *
 * Ba phạm vi (xem `shared/core/app/authorization/PermissionScope.ts`):
 *  - `all`  → HR/Admin: không giới hạn.
 *  - `team` → Manager: chính mình + toàn bộ cấp dưới trực tiếp VÀ gián tiếp.
 *  - `self` → Employee: đúng một mình.
 *
 * Actor được nhận diện qua `accountId` của nhân viên (userId = accountId, xem
 * `ProjectUserFromAccountUseCase`). Actor có phạm vi `team`/`self` mà KHÔNG gắn
 * với nhân viên nào (vd tài khoản admin thuần) thì không thấy gì — cố ý: thà
 * trả rỗng còn hơn lộ toàn bộ hồ sơ vì thiếu liên kết.
 */
export default class EmployeeAccessScope {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
    ) {}

    /**
     * Tập id nhân viên actor được đọc. `undefined` = không giới hạn (phạm vi
     * `all`) — caller không thêm điều kiện lọc nào.
     *
     * @throws {AccessDeniedError} Actor không có quyền đọc hồ sơ nhân viên.
     */
    public async visibleEmployeeIds(actorUserId: string): Promise<string[] | undefined> {
        const scope = await this._permissions.resolveScope(actorUserId, EMPLOYEE_READ_PERMISSION_KEY);
        if (scope === "all") return undefined;

        const actorEmployee = await this._employeeRepo.getByAccountId(actorUserId);
        if (actorEmployee == undefined) return [];

        if (scope === "self") return [actorEmployee.id];

        return this._teamIds(actorEmployee.id);
    }

    /**
     * Chốt chặn cho use-case đọc MỘT bản ghi cụ thể.
     *
     * @throws {AccessDeniedError} Nhân viên này ngoài phạm vi của actor.
     */
    public async assertCanRead(actorUserId: string, employeeId: string): Promise<void> {
        const visible = await this.visibleEmployeeIds(actorUserId);
        if (visible == undefined) return;
        if (!visible.includes(employeeId)) throw new AccessDeniedError();
    }

    /**
     * Chính mình + cấp dưới mọi tầng, duyệt theo chiều rộng. Tự chống vòng lặp
     * bằng tập đã thăm nên dữ liệu quản lý bị tạo vòng cũng không treo.
     */
    private async _teamIds(rootEmployeeId: string): Promise<string[]> {
        const collected = new Set<string>([rootEmployeeId]);
        let frontier    = [rootEmployeeId];

        for (let depth = 0; depth < MAX_MANAGER_CHAIN_DEPTH && frontier.length > 0; depth += 1) {
            const nextFrontier: string[] = [];

            for (const managerId of frontier) {
                for (const reportId of await this._employeeRepo.listDirectReportIds(managerId)) {
                    if (collected.has(reportId)) continue;
                    collected.add(reportId);
                    nextFrontier.push(reportId);
                }
            }

            frontier = nextFrontier;
        }

        return [...collected];
    }
}
