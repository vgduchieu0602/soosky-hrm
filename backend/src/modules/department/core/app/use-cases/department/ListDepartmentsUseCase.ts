import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import { assembleDepartments, DepartmentRow, DeptNode } from "@modules/department/core/domain/department-tree";
import Department from "@modules/department/core/domain/entities/Department";

export interface ListDepartmentsInput {
    tree: boolean;
}

/**
 * Liệt kê phòng ban ở dạng phẳng hoặc cây (rừng) tuỳ `tree`. Mở cho mọi user
 * đã xác thực.
 */
export default class ListDepartmentsUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: ListDepartmentsInput): Promise<DeptNode[]> {
        const departments = await this._departmentRepo.listAll();
        const rows: DepartmentRow[] = departments.map(toRow);
        return assembleDepartments(rows, input.tree);
    }
}

function toRow(department: Department): DepartmentRow {
    return {
        id:                 department.id,
        name:               department.name.value,
        code:               department.code.value,
        parentDepartmentId: department.parentDepartmentId,
        managerId:          department.managerId,
        description:        department.description.value,
        status:             department.status.value,
    };
}
