import SymbolCodeConflictError from "@modules/attendance/core/app/errors/SymbolCodeConflictError";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";
import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";
import SymbolCode from "@modules/attendance/core/domain/value-objects/SymbolCode";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_KEY = "attendance:manage";

export interface CreateAttendanceSymbolInput {
    code:         string;
    name:         string;
    description?: string;
    actorUserId:  string;
}

export interface CreateAttendanceSymbolOutput {
    symbolId: string;
}

/**
 * Tạo mới một ký hiệu chấm công.
 *
 * @throws {AccessDeniedError}      Actor không có quyền `attendance:manage`.
 * @throws {SymbolCodeInvalidError} Mã không hợp lệ.
 * @throws {SymbolCodeConflictError} Mã đã tồn tại.
 */
export default class CreateAttendanceSymbolUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _symbolRepo:  AttendanceSymbolRepo,
    ) {}

    public async execute(input: CreateAttendanceSymbolInput): Promise<CreateAttendanceSymbolOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const code = SymbolCode.create(input.code);

        const existing = await this._symbolRepo.getByCode(code.value);
        if (existing != undefined) throw new SymbolCodeConflictError();

        const symbol = AttendanceSymbol.create({
            id:          createUuidV7(),
            code,
            name:        input.name,
            description: input.description ?? "",
        });

        await this._symbolRepo.save(symbol);

        return { symbolId: symbol.id };
    }
}
