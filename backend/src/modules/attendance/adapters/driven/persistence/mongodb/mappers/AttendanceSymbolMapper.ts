import AttendanceSymbolDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/AttendanceSymbolDocument";
import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";
import SymbolCode from "@modules/attendance/core/domain/value-objects/SymbolCode";

const AttendanceSymbolMapper = {
    toDocument(symbol: AttendanceSymbol): AttendanceSymbolDocument {
        return {
            _id:         symbol.id,
            code:        symbol.code.value,
            name:        symbol.name,
            description: symbol.description,
            createdAt:   symbol.createdAt,
        };
    },

    toDomain(document: AttendanceSymbolDocument): AttendanceSymbol {
        return AttendanceSymbol.rehydrate({
            id:          document._id,
            code:        SymbolCode.create(document.code),
            name:        document.name,
            description: document.description,
            createdAt:   document.createdAt,
        });
    },
};

export default AttendanceSymbolMapper;
