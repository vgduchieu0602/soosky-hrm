import HolidayName from "@modules/attendance/core/domain/value-objects/HolidayName";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface HolidayCreationInput {
    id:          string;
    name:        HolidayName;
    date:        Date;
    isRecurring: boolean;
}

export interface HolidayProps {
    id:          string;
    name:        HolidayName;
    date:        Date;
    isRecurring: boolean;
    createdAt:   Date;
}

/**
 * Aggregate ngày lễ. `isRecurring` = true nghĩa là lặp lại hàng năm theo
 * ngày/tháng (vd: Quốc khánh 2/9), khớp theo `mmddKey` bất kể năm.
 */
export default class Holiday extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _name: HolidayName,
        private _date: Date,
        private _isRecurring: boolean,
    ) {
        super();
    }

    get name(): HolidayName {
        return this._name;
    }
    get date(): Date {
        return this._date;
    }
    get isRecurring(): boolean {
        return this._isRecurring;
    }

    static create(input: HolidayCreationInput): Holiday {
        return new Holiday(input.id, new Date(), input.name, input.date, input.isRecurring);
    }

    static rehydrate(props: HolidayProps): Holiday {
        return new Holiday(props.id, props.createdAt, props.name, props.date, props.isRecurring);
    }

    rename(name: HolidayName): void {
        this._name = name;
    }

    reschedule(date: Date, isRecurring: boolean): void {
        this._date = date;
        this._isRecurring = isRecurring;
    }
}
