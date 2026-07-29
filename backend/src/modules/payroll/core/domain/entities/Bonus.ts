import CompensationCatalogInvalidError from "@modules/payroll/core/domain/errors/CompensationCatalogInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface BonusProps {
    id:              string;
    employeeId:      string;
    payrollPeriodId: string;
    name:            string;
    amount:          number;
    isTaxable:       boolean;
    reason:          string | null;
    createdAt:       Date;
}

/** Thưởng một lần gắn với một kỳ lương cụ thể — luôn cộng vào Gross, không vào nền BH. */
export default class Bonus extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        public readonly payrollPeriodId: string,
        private _name: string,
        private _amount: number,
        private _isTaxable: boolean,
        private _reason: string | null,
    ) {
        super();
    }

    get name(): string { return this._name; }
    get amount(): number { return this._amount; }
    get isTaxable(): boolean { return this._isTaxable; }
    get reason(): string | null { return this._reason; }

    static create(input: Omit<BonusProps, "createdAt">): Bonus {
        return Bonus.rehydrate({ ...input, createdAt: new Date() });
    }

    static rehydrate(props: BonusProps): Bonus {
        if (props.name.trim().length === 0) {
            throw new CompensationCatalogInvalidError("Bonus name must not be empty");
        }
        if (props.amount < 0) {
            throw new CompensationCatalogInvalidError("Bonus amount must not be negative");
        }
        return new Bonus(
            props.id, props.createdAt, props.employeeId, props.payrollPeriodId,
            props.name.trim(), props.amount, props.isTaxable, props.reason,
        );
    }

    update(patch: { name?: string; amount?: number; isTaxable?: boolean; reason?: string | null }): void {
        if (patch.name != undefined) {
            if (patch.name.trim().length === 0) throw new CompensationCatalogInvalidError("Bonus name must not be empty");
            this._name = patch.name.trim();
        }
        if (patch.amount != undefined) {
            if (patch.amount < 0) throw new CompensationCatalogInvalidError("Bonus amount must not be negative");
            this._amount = patch.amount;
        }
        if (patch.isTaxable != undefined) this._isTaxable = patch.isTaxable;
        if (patch.reason !== undefined) this._reason = patch.reason;
    }
}
