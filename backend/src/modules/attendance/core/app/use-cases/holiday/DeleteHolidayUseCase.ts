import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";

const PERMISSION_KEY = "attendance:manage";

export interface DeleteHolidayInput {
    holidayId:   string;
    actorUserId: string;
}

/**
 * Xoá hẳn một ngày lễ. Idempotent: ngày lễ không tồn tại thì bỏ qua.
 *
 * @throws {AccessDeniedError} Actor không có quyền `attendance:manage`.
 */
export default class DeleteHolidayUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _holidayRepo: HolidayRepo,
    ) {}

    public async execute(input: DeleteHolidayInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._holidayRepo.deleteById(input.holidayId);
    }
}
