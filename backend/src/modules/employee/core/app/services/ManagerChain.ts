import ManagerCycleError from "@modules/employee/core/app/errors/ManagerCycleError";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";

/** Trần độ sâu khi leo chuỗi quản lý — chặn treo nếu dữ liệu cũ đã có vòng. */
const MAX_MANAGER_CHAIN_DEPTH = 50;

/**
 * Kiểm tra tính hợp lệ của chuỗi quản lý trực tiếp.
 *
 * Vì sao phải chặn vòng: phân quyền phạm vi `team` duyệt theo chuỗi này, báo
 * cáo tổ chức cũng vậy. Một vòng (A quản B, B quản A) khiến "cấp dưới của A"
 * gồm cả A — Manager tự xem được hồ sơ của chính cấp trên mình, và mọi thuật
 * toán duyệt cây phải tự phòng vệ. Chặn ngay lúc ghi rẻ hơn nhiều.
 */
export default class ManagerChain {
    public constructor(
        private readonly _employeeRepo: EmployeeRepo,
    ) {}

    /**
     * Gán `managerId` làm quản lý của `employeeId` có tạo vòng không.
     *
     * @throws {ManagerCycleError} Tự quản lý chính mình, hoặc quản lý mới nằm
     *                             trong nhánh cấp dưới của nhân viên này.
     */
    public async assertNoCycle(employeeId: string, managerId: string): Promise<void> {
        if (employeeId === managerId) throw new ManagerCycleError();

        // Leo từ quản lý mới lên trên: gặp lại chính nhân viên nghĩa là nhân
        // viên đang là cấp trên (gián tiếp) của quản lý mới → thành vòng.
        const visited = new Set<string>([managerId]);
        let currentId: string | null = managerId;

        for (let depth = 0; depth < MAX_MANAGER_CHAIN_DEPTH; depth += 1) {
            const current = await this._employeeRepo.getById(currentId);
            const nextId  = current?.managerId ?? null;

            if (nextId == null) return;
            if (nextId === employeeId) throw new ManagerCycleError();
            // Vòng đã tồn tại từ trước ở nhánh trên — không phải lỗi của thao
            // tác này, nhưng cũng không đi tiếp được.
            if (visited.has(nextId)) return;

            visited.add(nextId);
            currentId = nextId;
        }
    }
}
