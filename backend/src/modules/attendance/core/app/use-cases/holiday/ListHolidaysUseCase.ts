import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";

/** Liệt kê toàn bộ ngày lễ. */
export default class ListHolidaysUseCase {
    public constructor(
        private readonly _holidayRepo: HolidayRepo,
    ) {}

    public async execute(): Promise<Holiday[]> {
        return this._holidayRepo.listAll();
    }
}
