import DepartmentNotFoundError from "@modules/department/core/app/errors/DepartmentNotFoundError";
import PositionCodeConflictError from "@modules/department/core/app/errors/PositionCodeConflictError";
import DepartmentRepo from "@modules/department/core/app/ports/DepartmentRepo";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";
import Position from "@modules/department/core/domain/entities/Position";
import Description from "@modules/department/core/domain/value-objects/Description";
import PositionCode from "@modules/department/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "department:manage";
const DEFAULT_LEVEL  = 1;

export interface CreatePositionInput {
    code:         string;
    title:        string;
    departmentId: string;
    level?:       number;
    description?: string;
    actorUserId:  string;
}

export interface CreatePositionOutput {
    positionId: string;
}

/**
 * Tạo mới một vị trí trong một phòng ban.
 *
 * @throws {AccessDeniedError}         Actor không có quyền `department:manage`.
 * @throws {DepartmentNotFoundError}   Phòng ban không tồn tại.
 * @throws {PositionCodeConflictError} Mã vị trí đã tồn tại.
 * @throws {PositionCodeInvalidError | PositionTitleInvalidError | PositionLevelInvalidError} Giá trị không hợp lệ.
 */
export default class CreatePositionUseCase {
    public constructor(
        private readonly _permissions:    PermissionChecker,
        private readonly _positionRepo:   PositionRepo,
        private readonly _departmentRepo: DepartmentRepo,
    ) {}

    public async execute(input: CreatePositionInput): Promise<CreatePositionOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const department = await this._departmentRepo.getById(input.departmentId);
        if (department == undefined) throw new DepartmentNotFoundError();

        const code     = PositionCode.create(input.code);
        const existing = await this._positionRepo.getByCode(code.value);
        if (existing != undefined) throw new PositionCodeConflictError();

        const position = Position.create({
            id:           createUuidV7(),
            code,
            title:        PositionTitle.create(input.title),
            departmentId: input.departmentId,
            level:        PositionLevel.create(input.level ?? DEFAULT_LEVEL),
            description:  Description.create(input.description),
        });

        await this._positionRepo.save(position);

        return { positionId: position.id };
    }
}
