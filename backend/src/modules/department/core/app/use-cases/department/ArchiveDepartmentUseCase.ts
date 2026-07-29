import DepartmentHasChildrenError from "@modules/department/core/app/errors/DepartmentHasChildrenError";
import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "department:manage";

export interface ArchiveDepartmentInput {
    departmentId: string;
    actorUserId:  string;
}

/**
 * Lưu trữ (archive) phòng ban. Chặn nếu còn phòng ban con đang active.
 *
 * @throws {AccessDeniedError}          Actor không có quyền `department:manage`.
 * @throws {DepartmentNotFoundError}    Phòng ban không tồn tại.
 * @throws {DepartmentHasChildrenError} Còn phòng ban con đang hoạt động.
 */
export default class ArchiveDepartmentUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: ArchiveDepartmentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const children = await this._departmentRepo.listChildren(department.id);
        if (children.some(child => child.status.isActive)) {
            throw new DepartmentHasChildrenError("Cannot archive department with active sub-departments");
        }

        department.archive();
        await this._departmentRepo.save(department);
    }
}
