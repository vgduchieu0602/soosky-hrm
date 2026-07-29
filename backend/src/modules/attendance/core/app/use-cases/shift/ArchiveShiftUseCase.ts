import ShiftNotFoundError from "@modules/attendance/core/app/errors/ShiftNotFoundError";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";

const PERMISSION_KEY = "attendance:manage";

export interface ArchiveShiftInput {
    shiftId:     string;
    actorUserId: string;
}

/**
 * Lưu trữ (soft-remove) một ca làm việc — vẫn giữ để tham chiếu lịch sử chấm công.
 *
 * @throws {AccessDeniedError}  Actor không có quyền `attendance:manage`.
 * @throws {ShiftNotFoundError} Không tìm thấy ca.
 */
export default class ArchiveShiftUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _shiftRepo:   ShiftRepo,
    ) {}

    public async execute(input: ArchiveShiftInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const shift = await this._shiftRepo.getById(input.shiftId);
        if (shift == undefined) throw new ShiftNotFoundError();

        shift.archive();
        await this._shiftRepo.save(shift);
    }
}
