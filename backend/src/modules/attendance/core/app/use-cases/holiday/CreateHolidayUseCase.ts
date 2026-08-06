import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";
import HolidayName from "@modules/attendance/core/domain/value-objects/HolidayName";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "attendance:manage";

export interface CreateHolidayInput {
    name:        string;
    date:        Date;
    isRecurring?: boolean;
    actorUserId: string;
}

export interface CreateHolidayOutput {
    holidayId: string;
}

/**
 * Tạo mới một ngày lễ.
 *
 * @throws {AccessDeniedError}      Actor không có quyền `attendance:manage`.
 * @throws {HolidayNameInvalidError} Tên không hợp lệ.
 */
export default class CreateHolidayUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _holidayRepo: HolidayRepo,
    ) {}

    public async execute(input: CreateHolidayInput): Promise<CreateHolidayOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const holiday = Holiday.create({
            id:          createUuidV7(),
            name:        HolidayName.create(input.name),
            date:        input.date,
            isRecurring: input.isRecurring ?? false,
        });

        await this._holidayRepo.save(holiday);

        return { holidayId: holiday.id };
    }
}
