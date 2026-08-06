import EmployeeRepo, { EmployeeListFilter } from "@modules/employee/core/app/ports/EmployeeRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import Employee from "@modules/employee/core/domain/entities/Employee";

export interface ListEmployeesInput extends EmployeeListFilter {
    actorUserId: string;
}

/**
 * Liệt kê nhân viên trong PHẠM VI actor được phép đọc, kèm lọc theo phòng
 * ban/trạng thái.
 *
 * Phạm vi được áp bằng cách giao thêm điều kiện `ids` vào truy vấn chứ không
 * lọc sau khi đọc: Manager/Employee không bao giờ tải về bản ghi họ không được
 * xem, kể cả trong bộ nhớ.
 *
 * @throws {AccessDeniedError} Actor không có quyền đọc hồ sơ nhân viên.
 */
export default class ListEmployeesUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _employeeRepo: EmployeeRepo,
    ) {}

    public async execute(input: ListEmployeesInput): Promise<Employee[]> {
        const { actorUserId, ...filter } = input;

        const visibleIds = await this._accessScope.visibleEmployeeIds(actorUserId);
        if (visibleIds != undefined && visibleIds.length === 0) return [];

        return this._employeeRepo.list({
            ...filter,
            ...(visibleIds == undefined ? {} : { ids: visibleIds }),
        });
    }
}
