import PositionNotFoundError from "@modules/department/core/app/errors/PositionNotFoundError";
import PermissionChecker from "@modules/department/core/app/ports/PermissionChecker";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";

const PERMISSION_KEY = "department:manage";

export interface DeletePositionInput {
    positionId:  string;
    actorUserId: string;
}

/**
 * Xoá cứng một vị trí. Chưa có module nhân sự nên không đếm nhân viên tham
 * chiếu — ràng buộc đó sẽ bổ sung sau qua gateway/EventBus.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `department:manage`.
 * @throws {PositionNotFoundError} Vị trí không tồn tại.
 */
export default class DeletePositionUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: DeletePositionInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();

        await this._positionRepo.deleteById(position.id);
    }
}
