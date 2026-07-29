import DepartmentCodeConflictError from "@modules/department/core/app/errors/DepartmentCodeConflictError";
import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import Description from "@modules/department/core/domain/value-objects/Description";

const PERMISSION_KEY = "department:manage";

export interface UpdateDepartmentInput {
    departmentId: string;
    name?:        string;
    code?:        string;
    description?: string;
    actorUserId:  string;
}

/**
 * Cập nhật tên/mã/mô tả phòng ban.
 *
 * @throws {AccessDeniedError}           Actor không có quyền `department:manage`.
 * @throws {DepartmentNotFoundError}     Phòng ban không tồn tại.
 * @throws {DepartmentCodeConflictError} Mã mới trùng với phòng ban khác.
 * @throws {DepartmentCodeInvalidError | DepartmentNameInvalidError} Giá trị không hợp lệ.
 */
export default class UpdateDepartmentUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: UpdateDepartmentInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        if (input.code != undefined) {
            const code   = DepartmentCode.create(input.code);
            const holder = await this._departmentRepo.getByCode(code.value);
            if (holder != undefined && holder.id !== department.id) {
                throw new DepartmentCodeConflictError();
            }
            department.changeCode(code);
        }
        if (input.name != undefined) {
            department.rename(DepartmentName.create(input.name));
        }
        if (input.description != undefined) {
            department.changeDescription(Description.create(input.description));
        }

        await this._departmentRepo.save(department);
    }
}
