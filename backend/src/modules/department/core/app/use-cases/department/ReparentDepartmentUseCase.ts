import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import ParentDepartmentNotFoundError from "@modules/department/core/app/errors/ParentDepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import { collectSubtreeIds } from "@modules/department/core/domain/department-tree";
import DepartmentCannotBeOwnParentError from "@modules/department/core/domain/errors/DepartmentCannotBeOwnParentError";
import DepartmentCycleError from "@modules/department/core/domain/errors/DepartmentCycleError";

const PERMISSION_KEY = "department:manage";

export interface ReparentDepartmentInput {
    departmentId:       string;
    parentDepartmentId: string | null;
    actorUserId:        string;
}

/**
 * Di chuyển phòng ban sang cha mới, chặn tự làm cha và chặn chu trình.
 *
 * @throws {AccessDeniedError}                 Actor không có quyền `department:manage`.
 * @throws {DepartmentNotFoundError}           Phòng ban không tồn tại.
 * @throws {ParentDepartmentNotFoundError}     Cha mới không tồn tại.
 * @throws {DepartmentCannotBeOwnParentError}  Cha mới trùng chính nó.
 * @throws {DepartmentCycleError}              Cha mới nằm trong cây con của nó.
 */
export default class ReparentDepartmentUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: ReparentDepartmentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const parentId = input.parentDepartmentId;
        if (parentId != undefined) {
            if (parentId === department.id) throw new DepartmentCannotBeOwnParentError();

            const parent = await this._departmentRepo.getById(parentId);
            if (parent == undefined) throw new ParentDepartmentNotFoundError();

            const all     = await this._departmentRepo.listAll();
            const subtree = collectSubtreeIds(
                all.map(d => ({ id: d.id, parentDepartmentId: d.parentDepartmentId })),
                department.id,
            );
            if (subtree.has(parentId)) throw new DepartmentCycleError();
        }

        department.reparent(parentId);
        await this._departmentRepo.save(department);
    }
}
