import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";

const PERMISSION_KEY = "attendance:manage";

export interface DeleteAttendanceSymbolInput {
    symbolId:    string;
    actorUserId: string;
}

/**
 * Xoá hẳn một ký hiệu chấm công. Idempotent: ký hiệu không tồn tại thì bỏ qua.
 *
 * @throws {AccessDeniedError} Actor không có quyền `attendance:manage`.
 */
export default class DeleteAttendanceSymbolUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _symbolRepo:  AttendanceSymbolRepo,
    ) {}

    public async execute(input: DeleteAttendanceSymbolInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._symbolRepo.deleteById(input.symbolId);
    }
}
