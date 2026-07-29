import SymbolNotFoundError from "@modules/attendance/core/app/errors/SymbolNotFoundError";
import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";
import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";

export interface GetAttendanceSymbolInput {
    symbolId: string;
}

/**
 * Lấy chi tiết một ký hiệu chấm công.
 *
 * @throws {SymbolNotFoundError} Không tìm thấy ký hiệu.
 */
export default class GetAttendanceSymbolUseCase {
    public constructor(
        private readonly _symbolRepo: AttendanceSymbolRepo,
    ) {}

    public async execute(input: GetAttendanceSymbolInput): Promise<AttendanceSymbol> {
        const symbol = await this._symbolRepo.getById(input.symbolId);
        if (symbol == undefined) throw new SymbolNotFoundError();
        return symbol;
    }
}
