import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import Shift from "@modules/attendance/core/domain/entities/Shift";

export interface ListShiftsInput {
    activeOnly?: boolean;
}

/** Liệt kê ca làm việc (tuỳ chọn chỉ lấy ca đang hoạt động). */
export default class ListShiftsUseCase {
    public constructor(
        private readonly _shiftRepo: ShiftRepo,
    ) {}

    public async execute(input: ListShiftsInput = {}): Promise<Shift[]> {
        return input.activeOnly ? this._shiftRepo.listActive() : this._shiftRepo.listAll();
    }
}
