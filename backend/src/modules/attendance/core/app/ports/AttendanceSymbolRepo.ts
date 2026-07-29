import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";

export default interface AttendanceSymbolRepo {
    getById(id: string): Promise<AttendanceSymbol | undefined>;
    getByCode(code: string): Promise<AttendanceSymbol | undefined>;
    listAll(): Promise<AttendanceSymbol[]>;
    save(symbol: AttendanceSymbol): Promise<void>;
    deleteById(id: string): Promise<void>;
}
