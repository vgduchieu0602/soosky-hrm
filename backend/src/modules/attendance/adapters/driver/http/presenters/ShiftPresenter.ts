import Shift from "@modules/attendance/core/domain/entities/Shift";

export interface ShiftDTO {
    id:           string;
    code:         string;
    name:         string;
    startTime:    string;
    endTime:      string;
    breakMinutes: number;
    workingDays:  number[];
    status:       string;
    createdAt:    string;
}

const ShiftPresenter = {
    toDTO(shift: Shift): ShiftDTO {
        return {
            id:           shift.id,
            code:         shift.code.value,
            name:         shift.name.value,
            startTime:    shift.window.startTime,
            endTime:      shift.window.endTime,
            breakMinutes: shift.window.breakMinutes,
            workingDays:  shift.workingDays,
            status:       shift.status.value,
            createdAt:    shift.createdAt.toISOString(),
        };
    },
};

export default ShiftPresenter;
