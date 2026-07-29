import PositionRepo, { PositionListFilter } from "@modules/department/core/app/ports/PositionRepo";
import Position from "@modules/department/core/domain/entities/Position";

/**
 * Liệt kê vị trí, lọc tuỳ chọn theo phòng ban và trạng thái. Mở cho mọi user
 * đã xác thực.
 */
export default class ListPositionsUseCase {
    public constructor(
        private readonly _positionRepo: PositionRepo,
    ) {}

    public async execute(input: PositionListFilter): Promise<Position[]> {
        return this._positionRepo.list(input);
    }
}
