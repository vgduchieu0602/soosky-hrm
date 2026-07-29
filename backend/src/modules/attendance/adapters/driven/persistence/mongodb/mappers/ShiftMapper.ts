import ShiftDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/ShiftDocument";
import Shift from "@modules/attendance/core/domain/entities/Shift";
import ShiftCode from "@modules/attendance/core/domain/value-objects/ShiftCode";
import ShiftName from "@modules/attendance/core/domain/value-objects/ShiftName";
import ShiftStatus from "@modules/attendance/core/domain/value-objects/ShiftStatus";
import ShiftTimeWindow from "@modules/attendance/core/domain/value-objects/ShiftTimeWindow";

const ShiftMapper = {
    toDocument(shift: Shift): ShiftDocument {
        return {
            _id:          shift.id,
            code:         shift.code.value,
            name:         shift.name.value,
            startTime:    shift.window.startTime,
            endTime:      shift.window.endTime,
            breakMinutes: shift.window.breakMinutes,
            workingDays:  shift.workingDays,
            status:       shift.status.value,
            createdAt:    shift.createdAt,
        };
    },

    toDomain(document: ShiftDocument): Shift {
        return Shift.rehydrate({
            id:          document._id,
            code:        ShiftCode.create(document.code),
            name:        ShiftName.create(document.name),
            window:      ShiftTimeWindow.create(document.startTime, document.endTime, document.breakMinutes),
            workingDays: document.workingDays,
            status:      ShiftStatus.create(document.status),
            createdAt:   document.createdAt,
        });
    },
};

export default ShiftMapper;
