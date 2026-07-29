import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import Department from "@modules/department/core/domain/entities/Department";

export interface GetDepartmentInput {
    departmentId: string;
}

/**
 * Lấy chi tiết một phòng ban. Mở cho mọi user đã xác thực.
 *
 * @throws {DepartmentNotFoundError} Phòng ban không tồn tại.
 */
export default class GetDepartmentUseCase {
    public constructor(
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: GetDepartmentInput): Promise<Department> {
        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();
        return department;
    }
}
