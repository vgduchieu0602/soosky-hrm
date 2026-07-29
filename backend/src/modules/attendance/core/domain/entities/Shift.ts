import ShiftCode from "@modules/attendance/core/domain/value-objects/ShiftCode";
import ShiftName from "@modules/attendance/core/domain/value-objects/ShiftName";
import ShiftStatus from "@modules/attendance/core/domain/value-objects/ShiftStatus";
import ShiftTimeWindow from "@modules/attendance/core/domain/value-objects/ShiftTimeWindow";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface ShiftCreationInput {
    id:           string;
    code:         ShiftCode;
    name:         ShiftName;
    window:       ShiftTimeWindow;
    /** Thứ áp dụng trong tuần, ISO 1..7 (1 = Thứ hai .. 7 = Chủ nhật). */
    workingDays:  number[];
}

export interface ShiftProps {
    id:          string;
    code:        ShiftCode;
    name:        ShiftName;
    window:      ShiftTimeWindow;
    workingDays: number[];
    status:      ShiftStatus;
    createdAt:   Date;
}

/**
 * Aggregate ca làm việc — khung giờ + thứ áp dụng trong tuần. Là đơn vị mà
 * chấm công (`Attendance`) khớp vào để tính công/trễ/sớm (xem
 * `core/domain/services/attendance-calc.ts`).
 */
export default class Shift extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: ShiftCode,
        private _name: ShiftName,
        private _window: ShiftTimeWindow,
        private _workingDays: number[],
        private _status: ShiftStatus,
    ) {
        super();
    }

    get code(): ShiftCode {
        return this._code;
    }
    get name(): ShiftName {
        return this._name;
    }
    get window(): ShiftTimeWindow {
        return this._window;
    }
    get workingDays(): number[] {
        return this._workingDays;
    }
    get status(): ShiftStatus {
        return this._status;
    }

    static create(input: ShiftCreationInput): Shift {
        return new Shift(
            input.id,
            new Date(),
            input.code,
            input.name,
            input.window,
            input.workingDays,
            ShiftStatus.ACTIVE,
        );
    }

    static rehydrate(props: ShiftProps): Shift {
        return new Shift(
            props.id,
            props.createdAt,
            props.code,
            props.name,
            props.window,
            props.workingDays,
            props.status,
        );
    }

    rename(name: ShiftName): void {
        this._name = name;
    }

    changeCode(code: ShiftCode): void {
        this._code = code;
    }

    changeWindow(window: ShiftTimeWindow): void {
        this._window = window;
    }

    changeWorkingDays(workingDays: number[]): void {
        this._workingDays = workingDays;
    }

    archive(): void {
        this._status = ShiftStatus.ARCHIVED;
    }

    activate(): void {
        this._status = ShiftStatus.ACTIVE;
    }

    /** Ca này có áp dụng cho ngày trong tuần ISO (1..7) hay không. */
    appliesToWeekday(isoWeekday: number): boolean {
        return this._workingDays.includes(isoWeekday);
    }
}
