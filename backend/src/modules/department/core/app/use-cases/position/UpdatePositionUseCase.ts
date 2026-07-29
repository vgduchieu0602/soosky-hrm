import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import PositionNotFoundError from "@modules/department/core/app/errors/PositionNotFoundError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";
import Description from "@modules/department/core/domain/value-objects/Description";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/department/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";

const PERMISSION_KEY = "department:manage";

export interface UpdatePositionInput {
    positionId:    string;
    title?:        string;
    departmentId?: string;
    level?:        number;
    description?:  string;
    status?:       string;
    actorUserId:   string;
}

/**
 * Cập nhật vị trí: đổi tên/level/mô tả, chuyển phòng ban, đổi trạng thái.
 *
 * @throws {AccessDeniedError}       Actor không có quyền `department:manage`.
 * @throws {PositionNotFoundError}   Vị trí không tồn tại.
 * @throws {DepartmentNotFoundError} Phòng ban đích (khi chuyển) không tồn tại.
 * @throws {PositionTitleInvalidError | PositionLevelInvalidError | PositionStatusInvalidError} Giá trị không hợp lệ.
 */
export default class UpdatePositionUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _positionRepo:   PositionRepo,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: UpdatePositionInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();

        if (input.departmentId != undefined) {
            const department = await this._departmentRepo.getById(input.departmentId);
            if (department == undefined) throw new DepartmentNotFoundError();
            position.moveToDepartment(input.departmentId);
        }
        if (input.title != undefined) {
            position.rename(PositionTitle.create(input.title));
        }
        if (input.level != undefined) {
            position.changeLevel(PositionLevel.create(input.level));
        }
        if (input.description != undefined) {
            position.changeDescription(Description.create(input.description));
        }
        if (input.status != undefined) {
            const status = PositionStatus.create(input.status);
            if (status.isActive) position.activate();
            else position.archive();
        }

        await this._positionRepo.save(position);
    }
}
