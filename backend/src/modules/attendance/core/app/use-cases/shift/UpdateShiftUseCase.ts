import ShiftNotFoundError from "@modules/attendance/core/app/errors/ShiftNotFoundError";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import ShiftName from "@modules/attendance/core/domain/value-objects/ShiftName";
import ShiftTimeWindow from "@modules/attendance/core/domain/value-objects/ShiftTimeWindow";

const PERMISSION_KEY = "attendance:manage";

export interface UpdateShiftInput {
    shiftId:       string;
    name?:         string;
    startTime?:    string;
    endTime?:      string;
    breakMinutes?: number;
    workingDays?:  number[];
    actorUserId:   string;
}

/**
 * Cập nhật một ca làm việc đang tồn tại.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `attendance:manage`.
 * @throws {ShiftNotFoundError}    Không tìm thấy ca.
 * @throws {ShiftNameInvalidError} Tên không hợp lệ.
 * @throws {ShiftTimeInvalidError} Khung giờ không hợp lệ.
 */
export default class UpdateShiftUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _shiftRepo:   ShiftRepo,
    ) {}

    public async execute(input: UpdateShiftInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const shift = await this._shiftRepo.getById(input.shiftId);
        if (shift == undefined) throw new ShiftNotFoundError();

        if (input.name != undefined) shift.rename(ShiftName.create(input.name));

        if (input.startTime != undefined || input.endTime != undefined || input.breakMinutes != undefined) {
            shift.changeWindow(ShiftTimeWindow.create(
                input.startTime    ?? shift.window.startTime,
                input.endTime      ?? shift.window.endTime,
                input.breakMinutes ?? shift.window.breakMinutes,
            ));
        }

        if (input.workingDays != undefined) shift.changeWorkingDays(input.workingDays);

        await this._shiftRepo.save(shift);
    }
}
