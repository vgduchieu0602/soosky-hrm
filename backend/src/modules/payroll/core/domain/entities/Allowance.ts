import CompensationCatalogInvalidError from "@modules/payroll/core/domain/errors/CompensationCatalogInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const ALLOWANCE_TYPES = ["fixed", "percentage"] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export interface AllowanceProps {
    id:              string;
    employeeId:      string;
    name:            string;
    type:            AllowanceType;
    /** VNĐ khi `type`='fixed'; % lương hợp đồng khi 'percentage'. */
    amount:          number;
    /** Cộng vào thu nhập tính thuế. */
    isTaxable:       boolean;
    /** Cộng vào nền đóng BHXH/BHYT. */
    isInsuranceBase: boolean;
    effectiveDate:   Date;
    endDate:         Date | null;
    createdAt:       Date;
}

/** Phụ cấp định kỳ gắn với nhân viên — được gộp vào mỗi kỳ lương khi còn hiệu lực. */
export default class Allowance extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        private _name: string,
        private _type: AllowanceType,
        private _amount: number,
        private _isTaxable: boolean,
        private _isInsuranceBase: boolean,
        private _effectiveDate: Date,
        private _endDate: Date | null,
    ) {
        super();
    }

    get name(): string { return this._name; }
    get type(): AllowanceType { return this._type; }
    get amount(): number { return this._amount; }
    get isTaxable(): boolean { return this._isTaxable; }
    get isInsuranceBase(): boolean { return this._isInsuranceBase; }
    get effectiveDate(): Date { return this._effectiveDate; }
    get endDate(): Date | null { return this._endDate; }

    /** Có hiệu lực tại một ngày cho trước (dùng khi gộp phụ cấp vào kỳ lương). */
    isActiveAt(date: Date): boolean {
        return this._effectiveDate <= date && (this._endDate == null || this._endDate >= date);
    }

    static create(input: Omit<AllowanceProps, "createdAt">): Allowance {
        return Allowance.rehydrate({ ...input, createdAt: new Date() });
    }

    static rehydrate(props: AllowanceProps): Allowance {
        if (props.name.trim().length === 0) {
            throw new CompensationCatalogInvalidError("Allowance name must not be empty");
        }
        if (props.amount < 0) {
            throw new CompensationCatalogInvalidError("Allowance amount must not be negative");
        }
        return new Allowance(
            props.id, props.createdAt, props.employeeId, props.name.trim(), props.type,
            props.amount, props.isTaxable, props.isInsuranceBase, props.effectiveDate, props.endDate,
        );
    }

    update(patch: {
        name?: string; type?: AllowanceType; amount?: number;
        isTaxable?: boolean; isInsuranceBase?: boolean; effectiveDate?: Date; endDate?: Date | null;
    }): void {
        if (patch.name != undefined) {
            if (patch.name.trim().length === 0) throw new CompensationCatalogInvalidError("Allowance name must not be empty");
            this._name = patch.name.trim();
        }
        if (patch.type != undefined) this._type = patch.type;
        if (patch.amount != undefined) {
            if (patch.amount < 0) throw new CompensationCatalogInvalidError("Allowance amount must not be negative");
            this._amount = patch.amount;
        }
        if (patch.isTaxable != undefined) this._isTaxable = patch.isTaxable;
        if (patch.isInsuranceBase != undefined) this._isInsuranceBase = patch.isInsuranceBase;
        if (patch.effectiveDate != undefined) this._effectiveDate = patch.effectiveDate;
        if (patch.endDate !== undefined) this._endDate = patch.endDate;
    }
}
