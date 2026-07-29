import PositionNotFoundError from "@modules/department/core/app/errors/PositionNotFoundError";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";

const PERMISSION_KEY = "department:manage";

export interface ArchivePositionInput {
    positionId:  string;
    actorUserId: string;
}

/**
 * Lưu trữ (soft) một vị trí — ẩn khỏi bộ chọn nhưng giữ tham chiếu lịch sử.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `department:manage`.
 * @throws {PositionNotFoundError} Vị trí không tồn tại.
 */
export default class ArchivePositionUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: ArchivePositionInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();

        position.archive();
        await this._positionRepo.save(position);
    }
}
