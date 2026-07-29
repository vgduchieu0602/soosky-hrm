import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";

const PERMISSION_KEY = "attendance:manage";

export interface DeleteShiftInput {
    shiftId:     string;
    actorUserId: string;
}

/**
 * Xoá hẳn một ca làm việc. Idempotent: ca không tồn tại thì bỏ qua.
 *
 * @throws {AccessDeniedError} Actor không có quyền `attendance:manage`.
 */
export default class DeleteShiftUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _shiftRepo:   ShiftRepo,
    ) {}

    public async execute(input: DeleteShiftInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._shiftRepo.deleteById(input.shiftId);
    }
}
