import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";

export interface AttendanceSymbolDTO {
    id:          string;
    code:        string;
    name:        string;
    description: string;
    createdAt:   string;
}

const AttendanceSymbolPresenter = {
    toDTO(symbol: AttendanceSymbol): AttendanceSymbolDTO {
        return {
            id:          symbol.id,
            code:        symbol.code.value,
            name:        symbol.name,
            description: symbol.description,
            createdAt:   symbol.createdAt.toISOString(),
        };
    },
};

export default AttendanceSymbolPresenter;
