import SymbolCode from "@modules/attendance/core/domain/value-objects/SymbolCode";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface AttendanceSymbolCreationInput {
    id:          string;
    code:        SymbolCode;
    name:        string;
    description: string;
}

export interface AttendanceSymbolProps {
    id:          string;
    code:        SymbolCode;
    name:        string;
    description: string;
    createdAt:   Date;
}

/** Aggregate ký hiệu chấm công (catalog) — vd "P" (phép), "KL" (không lương). */
export default class AttendanceSymbol extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: SymbolCode,
        private _name: string,
        private _description: string,
    ) {
        super();
    }

    get code(): SymbolCode {
        return this._code;
    }
    get name(): string {
        return this._name;
    }
    get description(): string {
        return this._description;
    }

    static create(input: AttendanceSymbolCreationInput): AttendanceSymbol {
        return new AttendanceSymbol(input.id, new Date(), input.code, input.name, input.description);
    }

    static rehydrate(props: AttendanceSymbolProps): AttendanceSymbol {
        return new AttendanceSymbol(props.id, props.createdAt, props.code, props.name, props.description);
    }

    update(name: string, description: string): void {
        this._name = name;
        this._description = description;
    }
}
