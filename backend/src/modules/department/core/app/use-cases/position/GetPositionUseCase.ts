import PositionNotFoundError from "@modules/department/core/app/errors/PositionNotFoundError";
import PositionRepo from "@modules/department/core/app/ports/PositionRepo";
import Position from "@modules/department/core/domain/entities/Position";

export interface GetPositionInput {
    positionId: string;
}

/**
 * Lấy chi tiết một vị trí. Mở cho mọi user đã xác thực.
 *
 * @throws {PositionNotFoundError} Vị trí không tồn tại.
 */
export default class GetPositionUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: GetPositionInput): Promise<Position> {
        const position = await this._positionRepo.getById(input.positionId);
        if (position == undefined) throw new PositionNotFoundError();
        return position;
    }
}
