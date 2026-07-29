import DepartmentHasChildrenError from "@modules/department/core/app/errors/DepartmentHasChildrenError";
import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";

const PERMISSION_KEY = "department:manage";

export interface DeleteDepartmentInput {
    departmentId: string;
    actorUserId:  string;
}

/**
 * Xoá cứng phòng ban — chỉ khi không còn phòng ban con và không còn vị trí nào
 * trỏ tới. (Ràng buộc nhân viên sẽ bổ sung khi có module employee.)
 *
 * @throws {AccessDeniedError}           Actor không có quyền `department:manage`.
 * @throws {DepartmentNotFoundError}     Phòng ban không tồn tại.
 * @throws {DepartmentHasChildrenError}  Còn phòng ban con hoặc vị trí phụ thuộc.
 */
export default class DeleteDepartmentUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _departmentRepo: DepartmentRepo,
        private readonly _positionRepo:   PositionRepo,
    ) {}

    public async execute(input: DeleteDepartmentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const [children, positions] = await Promise.all([
            this._departmentRepo.countChildren(department.id),
            this._positionRepo.countByDepartment(department.id),
        ]);

        if (children > 0 || positions > 0) {
            const parts: string[] = [];
            if (children > 0)  parts.push(`${children} sub-department(s)`);
            if (positions > 0) parts.push(`${positions} position(s)`);
            throw new DepartmentHasChildrenError(`Department still has ${parts.join(", ")}`);
        }

        await this._departmentRepo.deleteById(department.id);
    }
}
