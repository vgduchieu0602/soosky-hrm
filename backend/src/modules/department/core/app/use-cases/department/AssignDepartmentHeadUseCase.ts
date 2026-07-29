import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "department:manage";

export interface AssignDepartmentHeadInput {
    departmentId: string;
    managerId:    string | null;
    actorUserId:  string;
}

/**
 * Gán hoặc gỡ trưởng phòng. `managerId` là id mờ (chưa ràng buộc module nhân sự).
 *
 * @throws {AccessDeniedError}       Actor không có quyền `department:manage`.
 * @throws {DepartmentNotFoundError} Phòng ban không tồn tại.
 */
export default class AssignDepartmentHeadUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: AssignDepartmentHeadInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        if (input.managerId == undefined) {
            department.removeHead();
        } else {
            department.assignHead(input.managerId);
        }

        await this._departmentRepo.save(department);
    }
}
