import DepartmentCodeConflictError from "@modules/department/core/app/errors/DepartmentCodeConflictError";
import ParentDepartmentNotFoundError from "@modules/department/core/app/errors/ParentDepartmentNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import Department from "@modules/department/core/domain/entities/Department";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import Description from "@modules/department/core/domain/value-objects/Description";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "department:manage";

export interface CreateDepartmentInput {
    code:                string;
    name:                string;
    description?:        string;
    parentDepartmentId?: string;
    managerId?:          string;
    actorUserId:         string;
}

export interface CreateDepartmentOutput {
    departmentId: string;
}

/**
 * Tạo mới một phòng ban.
 *
 * @throws {AccessDeniedError}              Actor không có quyền `department:manage`.
 * @throws {DepartmentCodeInvalidError}     Mã không hợp lệ.
 * @throws {DepartmentNameInvalidError}     Tên không hợp lệ.
 * @throws {DepartmentCodeConflictError}    Mã đã tồn tại.
 * @throws {ParentDepartmentNotFoundError}  Phòng ban cha không tồn tại.
 */
export default class CreateDepartmentUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: CreateDepartmentInput): Promise<CreateDepartmentOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const code = DepartmentCode.create(input.code);

        const existing = await this._departmentRepo.getByCode(code.value);
        if (existing != undefined) throw new DepartmentCodeConflictError();

        if (input.parentDepartmentId != undefined) {
            const parent = await this._departmentRepo.getById(input.parentDepartmentId);
            if (parent == undefined) throw new ParentDepartmentNotFoundError();
        }

        const department = Department.create({
            id:                 UUIDv7(),
            code,
            name:               DepartmentName.create(input.name),
            description:        Description.create(input.description),
            parentDepartmentId: input.parentDepartmentId ?? null,
            managerId:          input.managerId ?? null,
        });

        await this._departmentRepo.save(department);

        return { departmentId: department.id };
    }
}
