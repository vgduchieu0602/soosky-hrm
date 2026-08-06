import ShiftCodeConflictError from "@modules/attendance/core/app/errors/ShiftCodeConflictError";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import Shift from "@modules/attendance/core/domain/entities/Shift";
import ShiftCode from "@modules/attendance/core/domain/value-objects/ShiftCode";
import ShiftName from "@modules/attendance/core/domain/value-objects/ShiftName";
import ShiftTimeWindow from "@modules/attendance/core/domain/value-objects/ShiftTimeWindow";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "attendance:manage";

export interface CreateShiftInput {
    code:         string;
    name:         string;
    startTime:    string;
    endTime:      string;
    breakMinutes: number;
    workingDays:  number[];
    actorUserId:  string;
}

export interface CreateShiftOutput {
    shiftId: string;
}

/**
 * Tạo mới một ca làm việc.
 *
 * @throws {AccessDeniedError}       Actor không có quyền `attendance:manage`.
 * @throws {ShiftCodeInvalidError}   Mã không hợp lệ.
 * @throws {ShiftNameInvalidError}   Tên không hợp lệ.
 * @throws {ShiftTimeInvalidError}   Khung giờ không hợp lệ.
 * @throws {ShiftCodeConflictError}  Mã đã tồn tại.
 */
export default class CreateShiftUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _shiftRepo:   ShiftRepo,
    ) {}

    public async execute(input: CreateShiftInput): Promise<CreateShiftOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const code = ShiftCode.create(input.code);

        const existing = await this._shiftRepo.getByCode(code.value);
        if (existing != undefined) throw new ShiftCodeConflictError();

        const shift = Shift.create({
            id:          createUuidV7(),
            code,
            name:        ShiftName.create(input.name),
            window:      ShiftTimeWindow.create(input.startTime, input.endTime, input.breakMinutes),
            workingDays: input.workingDays,
        });

        await this._shiftRepo.save(shift);

        return { shiftId: shift.id };
    }
}
