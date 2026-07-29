import HolidayNotFoundError from "@modules/attendance/core/app/errors/HolidayNotFoundError";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";

export interface GetHolidayInput {
    holidayId: string;
}

/**
 * Lấy chi tiết một ngày lễ.
 *
 * @throws {HolidayNotFoundError} Không tìm thấy ngày lễ.
 */
export default class GetHolidayUseCase {
    public constructor(
        private readonly _holidayRepo: HolidayRepo,
    ) {}

    public async execute(input: GetHolidayInput): Promise<Holiday> {
        const holiday = await this._holidayRepo.getById(input.holidayId);
        if (holiday == undefined) throw new HolidayNotFoundError();
        return holiday;
    }
}
