import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import AttendanceStatus from "@modules/attendance/core/domain/value-objects/AttendanceStatus";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface AttendanceCreationInput {
    id:             string;
    employeeId:     string;
    date:           Date;
    shiftId:        string;
    checkIn:        Date | null;
    checkOut:       Date | null;
    status:         AttendanceStatus;
    workHours:      number | null;
    lateMinutes:    number;
    earlyMinutes:   number;
    session:        AttendanceSession;
    congWeight:      number;
    source:         string;
    note:           string | null;
    leaveRequestId: string | null;
}

export type AttendanceProps = AttendanceCreationInput & { createdAt: Date };

/**
 * Aggregate bản ghi chấm công của một nhân viên tại một ca, trong một ngày.
 * Một ngày có thể có nhiều bản ghi (một cho mỗi ca được ghép — xem
 * `matchShifts`); mỗi bản ghi đóng góp `congWeight` công cho ngày đó.
 */
export default class Attendance extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        public readonly date: Date,
        private _shiftId: string,
        private _checkIn: Date | null,
        private _checkOut: Date | null,
        private _status: AttendanceStatus,
        private _workHours: number | null,
        private _lateMinutes: number,
        private _earlyMinutes: number,
        private _session: AttendanceSession,
        private _congWeight: number,
        private _source: string,
        private _note: string | null,
        private _leaveRequestId: string | null,
    ) {
        super();
    }

    get shiftId(): string {
        return this._shiftId;
    }
    get checkIn(): Date | null {
        return this._checkIn;
    }
    get checkOut(): Date | null {
        return this._checkOut;
    }
    get status(): AttendanceStatus {
        return this._status;
    }
    get workHours(): number | null {
        return this._workHours;
    }
    get lateMinutes(): number {
        return this._lateMinutes;
    }
    get earlyMinutes(): number {
        return this._earlyMinutes;
    }
    get session(): AttendanceSession {
        return this._session;
    }
    get congWeight(): number {
        return this._congWeight;
    }
    get source(): string {
        return this._source;
    }
    get note(): string | null {
        return this._note;
    }
    get leaveRequestId(): string | null {
        return this._leaveRequestId;
    }

    static create(input: AttendanceCreationInput): Attendance {
        return new Attendance(
            input.id, new Date(), input.employeeId, input.date, input.shiftId,
            input.checkIn, input.checkOut, input.status, input.workHours,
            input.lateMinutes, input.earlyMinutes, input.session, input.congWeight,
            input.source, input.note, input.leaveRequestId,
        );
    }

    static rehydrate(props: AttendanceProps): Attendance {
        return new Attendance(
            props.id, props.createdAt, props.employeeId, props.date, props.shiftId,
            props.checkIn, props.checkOut, props.status, props.workHours,
            props.lateMinutes, props.earlyMinutes, props.session, props.congWeight,
            props.source, props.note, props.leaveRequestId,
        );
    }

    applyPunch(fields: {
        checkIn:      Date | null;
        checkOut:     Date | null;
        status:       AttendanceStatus;
        workHours:    number | null;
        lateMinutes:  number;
        earlyMinutes: number;
        session:      AttendanceSession;
        congWeight:   number;
        source:       string;
    }): void {
        this._checkIn      = fields.checkIn;
        this._checkOut      = fields.checkOut;
        this._status        = fields.status;
        this._workHours      = fields.workHours;
        this._lateMinutes   = fields.lateMinutes;
        this._earlyMinutes  = fields.earlyMinutes;
        this._session        = fields.session;
        this._congWeight    = fields.congWeight;
        this._source        = fields.source;
    }

    changeNote(note: string | null): void {
        this._note = note;
    }
}
