import ShiftNotFoundError from "@modules/attendance/core/app/errors/ShiftNotFoundError";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import Shift from "@modules/attendance/core/domain/entities/Shift";

export interface GetShiftInput {
    shiftId: string;
}

/**
 * Lấy chi tiết một ca làm việc.
 *
 * @throws {ShiftNotFoundError} Không tìm thấy ca.
 */
export default class GetShiftUseCase {
    public constructor(
        private readonly _shiftRepo: ShiftRepo,
    ) {}

    public async execute(input: GetShiftInput): Promise<Shift> {
        const shift = await this._shiftRepo.getById(input.shiftId);
        if (shift == undefined) throw new ShiftNotFoundError();
        return shift;
    }
}
