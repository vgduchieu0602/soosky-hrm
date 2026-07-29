import HolidayNotFoundError from "@modules/attendance/core/app/errors/HolidayNotFoundError";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import HolidayName from "@modules/attendance/core/domain/value-objects/HolidayName";

const PERMISSION_KEY = "attendance:manage";

export interface UpdateHolidayInput {
    holidayId:    string;
    name?:        string;
    date?:        Date;
    isRecurring?: boolean;
    actorUserId:  string;
}

/**
 * Cập nhật một ngày lễ đang tồn tại.
 *
 * @throws {AccessDeniedError}       Actor không có quyền `attendance:manage`.
 * @throws {HolidayNotFoundError}    Không tìm thấy ngày lễ.
 * @throws {HolidayNameInvalidError} Tên không hợp lệ.
 */
export default class UpdateHolidayUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _holidayRepo: HolidayRepo,
    ) {}

    public async execute(input: UpdateHolidayInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const holiday = await this._holidayRepo.getById(input.holidayId);
        if (holiday == undefined) throw new HolidayNotFoundError();

        if (input.name != undefined) holiday.rename(HolidayName.create(input.name));
        if (input.date != undefined || input.isRecurring != undefined) {
            holiday.reschedule(input.date ?? holiday.date, input.isRecurring ?? holiday.isRecurring);
        }

        await this._holidayRepo.save(holiday);
    }
}
