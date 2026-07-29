import SymbolNotFoundError from "@modules/attendance/core/app/errors/SymbolNotFoundError";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";

const PERMISSION_KEY = "attendance:manage";

export interface UpdateAttendanceSymbolInput {
    symbolId:     string;
    name?:        string;
    description?: string;
    actorUserId:  string;
}

/**
 * Cập nhật một ký hiệu chấm công đang tồn tại.
 *
 * @throws {AccessDeniedError}   Actor không có quyền `attendance:manage`.
 * @throws {SymbolNotFoundError} Không tìm thấy ký hiệu.
 */
export default class UpdateAttendanceSymbolUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _symbolRepo:  AttendanceSymbolRepo,
    ) {}

    public async execute(input: UpdateAttendanceSymbolInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const symbol = await this._symbolRepo.getById(input.symbolId);
        if (symbol == undefined) throw new SymbolNotFoundError();

        symbol.update(input.name ?? symbol.name, input.description ?? symbol.description);

        await this._symbolRepo.save(symbol);
    }
}
