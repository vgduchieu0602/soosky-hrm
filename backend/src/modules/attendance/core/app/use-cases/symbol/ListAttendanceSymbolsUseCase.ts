import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";
import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";

/** Liệt kê toàn bộ ký hiệu chấm công. */
export default class ListAttendanceSymbolsUseCase {
    public constructor(
        private readonly _symbolRepo: AttendanceSymbolRepo,
    ) {}

    public async execute(): Promise<AttendanceSymbol[]> {
        return this._symbolRepo.listAll();
    }
}
